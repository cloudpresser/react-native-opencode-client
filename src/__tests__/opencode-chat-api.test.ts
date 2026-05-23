/**
 * Chat-focused OpenCode API integration tests.
 *
 * These tests run against a live OpenCode server and create sessions inside a
 * temporary directory under the current repository. The directory is removed
 * after the suite completes, even on failure.
 *
 * Usage: npx tsx src/__tests__/opencode-chat-api.test.ts [base-url]
 * Default base URL: http://localhost:4096
 * Optional auth: OPENCODE_API_KEY=... npx tsx ...
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE_URL = process.argv[2] || 'http://localhost:4096';
const API_KEY = process.env.OPENCODE_API_KEY;
const REPO_ROOT = process.cwd();
const TEMP_PARENT_DIR = path.join(REPO_ROOT, '.tmp');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface SessionRecord {
  id: string;
  title: string;
  directory?: string;
}

interface SessionCreateOptions {
  model?: {
    providerID: string;
    modelID: string;
  };
}

interface SseEvent {
  type: string;
  properties?: Record<string, any>;
}

interface WaitForStreamOptions {
  sessionId: string;
  prompt: string;
  timeoutMs?: number;
  onEvent?: (event: SseEvent, events: SseEvent[]) => Promise<void> | void;
  stopWhen: (event: SseEvent, events: SseEvent[]) => boolean;
}

const results: TestResult[] = [];
const createdSessionIds = new Set<string>();
const TEST_MODEL = {
  providerID: 'openai',
  modelID: 'gpt-5.4',
} as const;

let tempDir = '';
let cleanupStarted = false;

function authHeaders(): Record<string, string> {
  if (!API_KEY) return {};
  const credentials = Buffer.from(`opencode:${API_KEY}`).toString('base64');
  return { Authorization: `Basic ${credentials}` };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });

  return response;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err) });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err?.message || String(err)}`);
  }
}

async function testWithRetries(name: string, retries: number, fn: (attempt: number) => Promise<void>) {
  await test(name, async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      try {
        if (attempt > 1) {
          console.log(`    retry ${attempt - 1}/${retries}`);
        }
        await fn(attempt);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeRelevantEvent(event: SseEvent) {
  if (event.type === 'message.part.updated') {
    const part = event.properties?.part;
    return {
      type: event.type,
      sessionID: part?.sessionID,
      messageID: part?.messageID,
      role: part?.role,
      partType: part?.type,
      delta: event.properties?.delta,
      part,
    };
  }

  return {
    type: event.type,
    properties: event.properties,
  };
}

function logJson(label: string, value: unknown) {
  console.log(`    ${label}: ${JSON.stringify(value, null, 2)}`);
}

async function createTempTestDir() {
  await mkdir(TEMP_PARENT_DIR, { recursive: true });
  tempDir = path.join(
    TEMP_PARENT_DIR,
    `opencode-chat-api-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  );
  await mkdir(tempDir, { recursive: true });
  await writeFile(
    path.join(tempDir, 'README.txt'),
    'Temporary workspace for OpenCode chat integration tests. Safe to delete.\n',
    'utf8',
  );
  console.log(`Temporary test directory: ${tempDir}`);
}

async function cleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;

  for (const sessionId of createdSessionIds) {
    try {
      await requestJson(`${BASE_URL}/session/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.log(`    cleanup warning: failed to delete session ${sessionId}: ${String(error)}`);
    }
  }

  if (tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log(`    cleanup warning: failed to remove temp dir ${tempDir}: ${String(error)}`);
    }
  }
}

async function createSession(title: string, options?: SessionCreateOptions): Promise<SessionRecord> {
  const response = await requestJson(
    `${BASE_URL}/session?directory=${encodeURIComponent(tempDir)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        ...(options?.model ? { model: options.model } : {}),
      }),
    },
  );

  assert(response.ok, `Failed to create session: ${response.status}`);
  const session = (await response.json()) as SessionRecord;
  createdSessionIds.add(session.id);
  return session;
}

async function getMessages(sessionId: string) {
  const response = await requestJson(`${BASE_URL}/session/${sessionId}/message`);
  assert(response.ok, `Failed to fetch messages for ${sessionId}: ${response.status}`);
  return response.json();
}

function getAssistantToolParts(messages: any[]) {
  return messages
    .filter((message) => message.info?.role === 'assistant')
    .flatMap((message) => message.parts || [])
    .filter((part) => part.type === 'tool' || part.type === 'tool-invocation');
}

async function listPendingQuestions() {
  const response = await requestJson(`${BASE_URL}/question`);
  assert(response.ok, `Failed to fetch pending questions: ${response.status}`);
  return response.json();
}

async function listPendingPermissions() {
  const response = await requestJson(`${BASE_URL}/permission`);
  assert(response.ok, `Failed to fetch pending permissions: ${response.status}`);
  return response.json();
}

async function replyToQuestion(requestId: string, answers: string[][]) {
  const response = await requestJson(`${BASE_URL}/question/${requestId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  assert(response.ok, `Failed to reply to question ${requestId}: ${response.status}`);
}

async function replyToPermission(requestId: string, reply: 'once' | 'always' | 'reject', message?: string) {
  const response = await requestJson(`${BASE_URL}/permission/${requestId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply, ...(message ? { message } : {}) }),
  });
  assert(response.ok, `Failed to reply to permission ${requestId}: ${response.status}`);
}

async function waitForCondition<T>(
  label: string,
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 500,
): Promise<T> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForStream({ sessionId, prompt, timeoutMs = 90000, onEvent, stopWhen }: WaitForStreamOptions) {
  const controller = new AbortController();
  const response = await requestJson(`${BASE_URL}/event`, {
    headers: authHeaders(),
    signal: controller.signal,
  });

  assert(response.ok, `Failed to connect to SSE stream: ${response.status}`);
  if (!response.body) {
    throw new Error('SSE response did not include a body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];

  let timedOut = false;
  let prompted = false;
  let buffer = '';

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        const dataLines = rawEvent
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart());

        if (dataLines.length === 0) {
          continue;
        }

        const event = JSON.parse(dataLines.join('\n')) as SseEvent;

        if (event.type === 'server.connected' && !prompted) {
          prompted = true;
          const promptResponse = await requestJson(`${BASE_URL}/session/${sessionId}/prompt_async`, {
            method: 'POST',
            body: JSON.stringify({
              parts: [{ type: 'text', text: prompt }],
            }),
          });
          assert(promptResponse.ok, `Failed to send prompt_async: ${promptResponse.status}`);
          continue;
        }

        const isRelevant =
          event.properties?.sessionID === sessionId ||
          event.properties?.part?.sessionID === sessionId;

        if (!isRelevant) {
          continue;
        }

        events.push(event);
        if (onEvent) {
          await onEvent(event, events);
        }
        if (stopWhen(event, events)) {
          return events;
        }
      }
    }

    throw new Error('SSE stream ended before the expected event was observed');
  } catch (error) {
    if (timedOut) {
      const sample = events.slice(-5).map(summarizeRelevantEvent);
      throw new Error(`Timed out waiting for expected SSE event. Recent events: ${JSON.stringify(sample, null, 2)}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
    reader.releaseLock();
  }
}

async function run() {
  console.log(`\nRunning OpenCode chat API integration tests against ${BASE_URL}\n`);

  await createTempTestDir();

  process.once('SIGINT', () => {
    cleanup().finally(() => process.exit(130));
  });
  process.once('SIGTERM', () => {
    cleanup().finally(() => process.exit(143));
  });

  try {
    await test('creates a session inside the temp test directory', async () => {
      const session = await createSession('chat-api-temp-dir-check', { model: TEST_MODEL });
      assert(session.directory === tempDir, `Expected session directory ${tempDir}, got ${session.directory}`);
    });

    await test('captures assistant streaming events and final message parts', async () => {
      const session = await createSession('chat-api-streaming', { model: TEST_MODEL });
      const events = await waitForStream({
        sessionId: session.id,
        prompt: 'Is Atal Bihari Vajpayee the 10th Prime Minister of India, and if so, what is his fourth most important achievement? Explain your ranking briefly before answering.',
        stopWhen: (event) => event.type === 'session.status' && event.properties?.status?.type === 'idle',
      });

      const partUpdates = events.filter((event) => event.type === 'message.part.updated');
      assert(partUpdates.length > 0, 'Expected at least one message.part.updated event');

      logJson('sample message.part.updated event', summarizeRelevantEvent(partUpdates[0]));
      const reasoningEvents = events.filter((event) => {
        const partType = event.properties?.part?.type;
        return event.type === 'message.part.updated' && partType === 'reasoning';
      });
      if (reasoningEvents.length > 0) {
        logJson('sample reasoning event', summarizeRelevantEvent(reasoningEvents[0]));
      }
      const streamedReasoningEvents = reasoningEvents.filter((event) => {
        const text = event.properties?.part?.text;
        return typeof text === 'string' && text.trim().length > 0;
      });
      logJson(
        'reasoning stream summary',
        {
          totalReasoningEvents: reasoningEvents.length,
          nonEmptyReasoningEvents: streamedReasoningEvents.length,
          sampleNonEmptyReasoningEvent:
            streamedReasoningEvents.length > 0 ? summarizeRelevantEvent(streamedReasoningEvents[0]) : null,
        },
      );

      const messages = await getMessages(session.id);
      const assistantMessage = [...messages].reverse().find((message: any) => message.info?.role === 'assistant');
      assert(!!assistantMessage, 'Expected a final assistant message');
      assert(Array.isArray(assistantMessage.parts), 'Expected final assistant message to include parts');

      logJson('final assistant message parts', assistantMessage.parts);
      const finalReasoningParts = assistantMessage.parts.filter((part: any) => part.type === 'reasoning');
      logJson(
        'final reasoning summary',
        finalReasoningParts.map((part: any) => ({
          textLength: typeof part.text === 'string' ? part.text.length : 0,
          hasEncryptedContent: !!part.metadata?.openai?.reasoningEncryptedContent,
          textPreview: typeof part.text === 'string' ? part.text.slice(0, 200) : '',
        })),
      );
    });

    await testWithRetries('captures diff metadata for edit-style tools', 3, async (attempt) => {
      const targetFile = path.join(tempDir, `edit-target-${attempt}.txt`);
      await writeFile(targetFile, 'alpha\nbeta\ndelta\n', 'utf8');

      const session = await createSession(`chat-api-edit-attempt-${attempt}`, { model: TEST_MODEL });
      await waitForStream({
        sessionId: session.id,
        prompt: `Use the edit tool or apply_patch tool to change the line \"beta\" to \"gamma\" in ${path.basename(targetFile)}. Do not use the write tool. Stop after the edit succeeds.`,
        stopWhen: (event) => event.type === 'session.status' && event.properties?.status?.type === 'idle',
      });

      const messages = await getMessages(session.id);
      const toolParts = getAssistantToolParts(messages);
      const editToolPart = toolParts.find((part: any) => {
        if (part.type === 'tool') {
          return (part.tool === 'edit' || part.tool === 'apply_patch') && part.state?.status === 'completed';
        }
        return (
          (part.toolInvocation?.toolName === 'edit' || part.toolInvocation?.toolName === 'apply_patch') &&
          part.toolInvocation?.state === 'result'
        );
      });

      assert(!!editToolPart, 'Expected a completed edit/apply_patch tool part');
      logJson('edit/apply_patch tool part', editToolPart);

      if (editToolPart.type === 'tool') {
        const metadata = editToolPart.state?.metadata || {};
        const hasPatch =
          (typeof metadata.diff === 'string' && metadata.diff.trim().length > 0) ||
          (metadata.filediff && typeof metadata.filediff.patch === 'string' && metadata.filediff.patch.trim().length > 0) ||
          (Array.isArray(metadata.files) && metadata.files.some((file: any) => typeof file.patch === 'string' && file.patch.trim().length > 0));
        assert(hasPatch, 'Expected completed edit/apply_patch tool metadata to include diff data');
      }
    });

    await testWithRetries('observes write tool result shape or logs fallback behavior', 3, async (attempt) => {
      const fileName = `write-target-${attempt}.txt`;
      const targetFile = path.join(tempDir, fileName);
      const session = await createSession(`chat-api-write-attempt-${attempt}`, { model: TEST_MODEL });
      await waitForStream({
        sessionId: session.id,
        prompt: `Use the write tool to create ${fileName} with exactly the content \"hello from the write tool\". This request is specifically intended to inspect the write tool result shape, so prefer write over edit or apply_patch. Stop after the file is created.`,
        stopWhen: (event) => event.type === 'session.status' && event.properties?.status?.type === 'idle',
      });

      const messages = await getMessages(session.id);
      const toolParts = getAssistantToolParts(messages);
      const writeToolPart = toolParts.find((part: any) => {
        if (part.type === 'tool') {
          return part.tool === 'write' && part.state?.status === 'completed';
        }
        return part.toolInvocation?.toolName === 'write' && part.toolInvocation?.state === 'result';
      });

      if (writeToolPart) {
        logJson('write tool part', writeToolPart);
        if (writeToolPart.type === 'tool') {
          assert(typeof writeToolPart.state?.output === 'string', 'Expected write tool completed state to include output text');
        }
        return;
      }

      const fallbackToolPart = toolParts.find((part: any) => {
        if (part.type === 'tool') {
          return (part.tool === 'apply_patch' || part.tool === 'edit') && part.state?.status === 'completed';
        }
        return (
          (part.toolInvocation?.toolName === 'apply_patch' || part.toolInvocation?.toolName === 'edit') &&
          part.toolInvocation?.state === 'result'
        );
      });

      if (fallbackToolPart) {
        logJson('write fallback tool part', fallbackToolPart);
        return;
      }

      const fileExists = await import('node:fs/promises').then((fs) => fs.access(targetFile).then(() => true).catch(() => false));
      logJson('write tool diagnostic', {
        observedToolParts: toolParts.map((part: any) => ({
          type: part.type,
          tool: part.type === 'tool' ? part.tool : part.toolInvocation?.toolName,
          state: part.type === 'tool' ? part.state?.status : part.toolInvocation?.state,
        })),
        fileExists,
      });
    });

    await testWithRetries('captures a structured question payload and clears it after reply', 3, async (attempt) => {
      const session = await createSession(`chat-api-question-attempt-${attempt}`, { model: TEST_MODEL });
      const events = await waitForStream({
        sessionId: session.id,
        prompt: 'Use the question tool to ask me one structured question with exactly two answer options. Do not answer it yourself.',
        stopWhen: (event) => event.type === 'question.asked',
      });

      const questionEvent = events.find((event) => event.type === 'question.asked');
      if (!questionEvent) {
        throw new Error('Expected a question.asked event');
      }
      const questionProps = questionEvent.properties || {};
      logJson('question.asked payload', summarizeRelevantEvent(questionEvent));

      const pendingQuestions = await listPendingQuestions();
      const pendingQuestion = pendingQuestions.find((item: any) => item.id === questionProps.id);
      assert(!!pendingQuestion, 'Expected pending question to appear in GET /question');
      logJson('GET /question item', pendingQuestion);

      const answers = (questionProps.questions || []).map((question: any) => {
        const firstOption = question.options?.[0]?.label;
        return [firstOption || 'test answer'];
      });
      assert(answers.length > 0, 'Expected question payload to include at least one question');

      await replyToQuestion(questionProps.id, answers);
      await waitForCondition(
        `question ${questionProps.id} to clear`,
        listPendingQuestions,
        (items) => !items.some((item: any) => item.id === questionProps.id),
      );
    });

    await testWithRetries('captures a permission payload and clears it after v2 reply', 3, async (attempt) => {
      const session = await createSession(`chat-api-permission-attempt-${attempt}`, { model: TEST_MODEL });
      let replied = false;
      let pendingPermissionSnapshot: any | null = null;
      const events = await waitForStream({
        sessionId: session.id,
        prompt: 'Use the read tool to read ~/.zshrc. If permission is required, request permission and stop immediately without answering.',
        onEvent: async (event) => {
          if (event.type !== 'permission.asked' || replied) {
            return;
          }

          const permissionProps = event.properties || {};
          const pendingPermissions = await listPendingPermissions();
          pendingPermissionSnapshot = pendingPermissions.find((item: any) => item.id === permissionProps.id) ?? null;
          assert(!!pendingPermissionSnapshot, 'Expected pending permission to appear in GET /permission before reply');
          replied = true;
          await replyToPermission(permissionProps.id, 'reject', 'Rejected by integration test');
        },
        stopWhen: (event) => event.type === 'permission.replied',
      });

      const permissionEvent = events.find((event) => event.type === 'permission.asked');
      if (!permissionEvent) {
        throw new Error('Expected a permission.asked event');
      }
      const permissionProps = permissionEvent.properties || {};
      logJson('permission.asked payload', summarizeRelevantEvent(permissionEvent));
      const toolPartEvent = events.find(
        (event) =>
          event.type === 'message.part.updated' &&
          (event.properties?.part?.type === 'tool' || event.properties?.part?.type === 'tool-invocation'),
      );
      if (!toolPartEvent) {
        throw new Error('Expected a tool-related message part before permission reply');
      }
      logJson('sample tool part event', summarizeRelevantEvent(toolPartEvent));
      assert(!!pendingPermissionSnapshot, 'Expected pending permission snapshot before reply');
      logJson('GET /permission item', pendingPermissionSnapshot);

      const permissionRepliedEvent = events.find(
        (event) => event.type === 'permission.replied' && event.properties?.requestID === permissionProps.id,
      );
      if (!permissionRepliedEvent) {
        throw new Error('Expected a permission.replied event for the replied permission');
      }
      logJson('permission.replied payload', summarizeRelevantEvent(permissionRepliedEvent));

      await waitForCondition(
        `permission ${permissionProps.id} to clear`,
        listPendingPermissions,
        (items) => !items.some((item: any) => item.id === permissionProps.id),
      );
    });
  } finally {
    await cleanup();
  }

  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  ✗ ${result.name}: ${result.error}`);
    }
    process.exit(1);
  }

  console.log('\nAll tests passed!');
  process.exit(0);
}

run().catch(async (error) => {
  await cleanup();
  console.error('Fatal error:', error);
  process.exit(1);
});
