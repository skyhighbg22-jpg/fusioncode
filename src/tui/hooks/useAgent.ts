import React, { useRef } from 'react'
import { createAgent } from '../../agents/index.js'
import type { RuntimeContext } from '../../runtime/context.js'
import type { AgentMode, StreamEvent } from '../../types/index.js'
import type { TuiAction } from '../state.js'

/**
 * Wires the agent run loop to the TUI reducer. Returns a `submit` function
 * that starts a run, and a `cancel` function that aborts the active run.
 */
export function useAgent(
  runtime: RuntimeContext,
  mode: AgentMode,
  provider: string,
  model: string,
  dispatch: React.Dispatch<TuiAction>,
): {
  submit: (prompt: string) => Promise<void>
  cancel: () => void
} {
  const controllerRef = useRef<AbortController | null>(null)

  const submit = async (prompt: string): Promise<void> => {
    // Abort any in-flight run first.
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    dispatch({ type: 'submit', prompt })

    const onEvent = (e: StreamEvent & { sessionId: string }): void => {
      switch (e.type) {
        case 'text':
          if (e.content) dispatch({ type: 'text', content: e.content })
          break
        case 'tool_call':
          if (e.toolCall) {
            dispatch({
              type: 'tool_call',
              name: e.toolCall.function.name,
              args: e.toolCall.function.arguments,
            })
          }
          break
        case 'tool_result':
          if (e.toolResult) {
            dispatch({
              type: 'tool_result',
              name: e.toolResult.toolCallId,
              result: e.toolResult.result,
              isError: e.toolResult.isError,
            })
          }
          break
        case 'error':
          if (e.error === 'cancelled') {
            dispatch({ type: 'cancelled' })
          } else {
            dispatch({ type: 'error', message: e.error ?? 'unknown error' })
          }
          break
        case 'done':
          // The run() promise resolves with final text; 'done' here just
          // signals stream end. We finalize on promise resolution below.
          break
      }
    }

    try {
      const agent = createAgent({ mode, provider, model, runtime })
      const result = await agent.run(prompt, { onEvent, signal: controller.signal })
      dispatch({ type: 'done', content: result })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (/abort/i.test(message)) {
        dispatch({ type: 'cancelled' })
      } else {
        dispatch({ type: 'error', message })
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  const cancel = (): void => {
    controllerRef.current?.abort()
  }

  return { submit, cancel }
}
