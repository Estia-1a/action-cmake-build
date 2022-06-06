import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {StringDecoder} from 'string_decoder'
export interface CMakeExtraArgs {
  extraConfigArgs?: string
  extraBuildArgs?: string
  extraTestArgs?: string
  extraInstallArgs?: string
}

export interface CMakeOptions {
  buildType: string
  target?: string
  parallel?: string
  extraArgs?: CMakeExtraArgs
}

export class CMakeRunner {
  _cmake = 'cmake'
  _ctest = 'ctest'
  _options: CMakeOptions
  _rootDir: string
  _buildDir: string
  constructor(rootDir: string, buildDir: string, options: CMakeOptions) {
    this._options = options
    this._rootDir = rootDir
    this._buildDir = buildDir
  }

  async run(executable: string, args?: string[]): Promise<exec.ExecOutput> {
    const output = {exitCode: -1, stdout: '', stderr: ''}
    try {
      //Using string decoder covers the case where a mult-byte character is split
      const stdoutDecoder = new StringDecoder('utf8')
      const stderrDecoder = new StringDecoder('utf8')

      const stdErrListener = (data: Buffer): void => {
        output.stderr += stderrDecoder.write(data)
      }

      const stdOutListener = (data: Buffer): void => {
        output.stdout += stdoutDecoder.write(data)
      }

      const listeners = {
        stdout: stdOutListener,
        stderr: stdErrListener
      }

      output.exitCode = await exec.exec(executable, args, {listeners})
      return output
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(error.message)
        output.stderr += '\n'
        output.stderr += error.message
      } else {
        core.setFailed('')
      }
      return output
    }
  }

  async cmake(args?: string[]): Promise<exec.ExecOutput> {
    // console.log('cmake ' + args?.join(' '))
    // return new Promise<number>((resolve) => {})
    return await this.run(this._cmake, args)
  }

  async ctest(args?: string[]): Promise<exec.ExecOutput> {
    // console.log('cmake ' + args?.join(' '))
    // return new Promise<number>((resolve) => {})
    return await this.run(this._ctest, args)
  }

  async configure(): Promise<exec.ExecOutput> {
    let execOptions: string[] = [
      `-DCMAKE_BUILD_TYPE=${this._options.buildType}`,
      `-S${this._rootDir}`,
      `-B${this._buildDir}`
    ]

    if (this._options.extraArgs?.extraConfigArgs) {
      execOptions = [
        ...this._options.extraArgs.extraConfigArgs.split(' '),
        ...execOptions
      ]
    }
    return this.cmake(execOptions)
  }

  async build(): Promise<exec.ExecOutput> {
    let execOptions: string[] = [
      `--build`,
      this._buildDir,
      '--config',
      this._options.buildType
    ]
    if (this._options.target) {
      execOptions = [...execOptions, '--target', this._options.target]
    }
    if (this._options.parallel) {
      execOptions = [...execOptions, '--parallel', this._options.parallel]
    }
    if (this._options.extraArgs?.extraBuildArgs) {
      execOptions = [
        ...execOptions,
        ...this._options.extraArgs.extraBuildArgs.split(' ')
      ]
    }
    return this.cmake(execOptions)
  }

  async install(): Promise<exec.ExecOutput> {
    let execOptions: string[] = [`--install`, this._buildDir]
    if (this._options.extraArgs?.extraInstallArgs) {
      execOptions = [
        ...execOptions,
        ...this._options.extraArgs.extraInstallArgs.split(' ')
      ]
    }
    return this.cmake(execOptions)
  }

  async test(): Promise<number> {
    const pwdCurrent: string = process.cwd()
    process.chdir(this._buildDir)

    // '-C' is required for multiconfig build systems
    let execOptions: string[] = ['-C', this._options.buildType]
    if (this._options.extraArgs?.extraTestArgs) {
      execOptions = [
        ...execOptions,
        ...this._options.extraArgs.extraTestArgs.split(' ')
      ]
    }
    const {exitCode} = await this.ctest(execOptions)
    process.chdir(pwdCurrent)
    return exitCode
  }
}
