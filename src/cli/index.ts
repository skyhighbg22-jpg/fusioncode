#!/usr/bin/env node
// ============================================================
// FusionCode — CLI Entry Point
// Inspired by: OpenCode CLI, Kilo CLI, OpenClaude CLI,
//              Aider's single-file simplicity
// ============================================================

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { execa } from 'execa'
import { createAgent } from '../agents/index.js'
import { loadConfig, saveConfig } from '../config/index.js'
import { getGitManager } from '../git/index.js'
import { toErrorMessage } from '../utils/errors.js'

const program = new Command()

program.name('fusion').description('FusionCode - The peak AI coding agent CLI').version('0.1.0')

// fusion run [prompt]
program
  .command('run [prompt...]')
  .description('Run the agent with a prompt')
  .option('--mode <mode>', 'Agent mode: build | plan | debug | review | check', 'build')
  .option(
    '--provider <provider>',
    'Provider to use (openai, deepseek, groq, mistral, openrouter, together, ollama, lmstudio, cohere, custom)',
  )
  .option('--model <model>', 'Model name override')
  .option('--auto', 'Autonomous mode: no user confirmation needed')
  .action(async (promptWords, options) => {
    try {
      const promptText = Array.isArray(promptWords) ? promptWords.join(' ') : String(promptWords ?? '')
      if (!promptText.trim()) {
        console.error(chalk.red('Error: prompt required. Usage: fusion run "implement feature X"'))
        process.exit(1)
      }

      const spinner = ora(`Starting ${options.mode} agent...`).start()
      const agent = createAgent({
        mode: options.mode,
        provider: options.provider,
        model: options.model,
      })

      spinner.text = `Running ${agent.modeName} agent (session: ${agent.sessionId.slice(0, 8)})...`

      let lastText = ''
      const result = await agent.run(promptText, {
        onEvent: (event) => {
          if (event.type === 'text' && event.content) {
            lastText += event.content
            spinner.text = `Agent thinking... ${lastText.slice(-50)}`
          } else if (event.type === 'tool_call' && event.toolCall) {
            spinner.text = `Calling tool: ${event.toolCall.function.name}`
          } else if (event.type === 'tool_result' && event.toolResult) {
            const preview = event.toolResult.result.slice(0, 60)
            spinner.text = `Tool result: ${preview}`
          }
        },
      })

      spinner.succeed(chalk.green('Agent completed!'))
      console.log(chalk.cyan('\n--- Agent Response ---'))
      console.log(result)
      console.log(chalk.cyan('\n--- Done ---'))

      // Show git diff summary if changes were made.
      const git = getGitManager()
      if ((await git.isGitRepo()) && (await git.hasChanges())) {
        const diff = await git.diff()
        console.log(
          chalk.yellow(
            `\n✓ Changes: ${diff.files.length} file(s), +${diff.additions}/-${diff.deletions} lines`,
          ),
        )
        console.log(chalk.dim('Run `git status` to review or `git diff` to see details.'))
      }
    } catch (e: unknown) {
      console.error(chalk.red('Error:'), toErrorMessage(e))
      process.exit(1)
    }
  })

// fusion init
program
  .command('init')
  .description('Initialize FusionCode in this project')
  .action(() => {
    console.log(chalk.blue('Initializing FusionCode...'))
    const config = loadConfig()
    saveConfig(config)
    console.log(chalk.green('✓ Created fusioncode.json'))
    console.log(chalk.green('✓ Ready! Run `fusion run "your prompt here"` to start.'))
  })

// fusion config
program
  .command('config')
  .description('Show or edit configuration')
  .option('--list', 'List all providers')
  .option('--set-provider <name>', 'Set default provider')
  .option('--set-model <model>', 'Set model for default provider')
  .action((options) => {
    const config = loadConfig()
    if (options.list) {
      console.log(chalk.blue('Available providers:'))
      for (const [name, prov] of Object.entries(config.providers)) {
        const active = name === config.defaultProvider ? chalk.green(' (active)') : ''
        console.log(`  - ${name}: ${prov.model}${active}`)
      }
      return
    }
    if (options.setProvider) {
      config.defaultProvider = options.setProvider
      saveConfig(config)
      console.log(chalk.green(`✓ Set default provider to: ${options.setProvider}`))
    }
    if (options.setModel) {
      config.providers[config.defaultProvider].model = options.setModel
      saveConfig(config)
      console.log(chalk.green(`✓ Set model to: ${options.setModel}`))
    }
    if (!options.setProvider && !options.setModel) {
      console.log(JSON.stringify(config, null, 2))
    }
  })

// fusion check — runs CI checks directly (no API key required).
program
  .command('check')
  .description('Run CI-style checks: typecheck, lint, tests')
  .action(async () => {
    console.log(chalk.blue('Running checks...\n'))
    const checks: Array<{ name: string; cmd: string; args: string[] }> = [
      { name: 'TypeScript', cmd: 'npx', args: ['tsc', '--noEmit'] },
      { name: 'ESLint', cmd: 'npx', args: ['eslint', 'src'] },
      { name: 'Tests', cmd: 'npx', args: ['vitest', 'run'] },
    ]

    let allPassed = true
    for (const check of checks) {
      const label = `${check.name}`.padEnd(12)
      try {
        const { stdout, stderr } = await execa(check.cmd, check.args, { reject: false })
        const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
        if (combined) console.log(chalk.dim(combined))
        console.log(chalk.green(`✓ ${label} passed`))
      } catch (e) {
        allPassed = false
        console.log(chalk.red(`✗ ${label} failed: ${toErrorMessage(e)}`))
      }
    }

    if (allPassed) {
      console.log(chalk.green('\n🎉 All checks passed!'))
    } else {
      console.log(chalk.yellow('\n⚠️  Some checks failed. Review the output above.'))
      process.exit(1)
    }
  })

program.parse(process.argv)
