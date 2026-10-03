import { randomUUID } from "node:crypto";

function cleanText(value, max = 500) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

/**
 * Create a bounded task plan.
 * Stage 1 uses deterministic planning.
 * A model-driven planner can be added in a later stage.
 */
export function createAgentTask({
  query,
  vision = false,
  research = false,
  mode = "auto",
}) {
  const steps = [
    {
      id: "understand",
      label: "Understand the request",
      status: "pending",
    },
  ];

  if (vision) {
    steps.push({
      id: "inspect-image",
      label: "Analyze the attached image",
      status: "pending",
    });
  }

  if (research) {
    steps.push({
      id: "research",
      label: "Gather relevant web sources",
      status: "pending",
    });
  }

  steps.push(
    {
      id: "respond",
      label: "Prepare the answer",
      status: "pending",
    },
    {
      id: "verify",
      label: "Check the response",
      status: "pending",
    },
  );

  return {
    taskId: randomUUID(),
    goal: cleanText(query, 5000),
    mode,
    kind: vision
      ? "vision"
      : research
        ? "research"
        : "conversation",
    status: "planning",
    currentStep: "understand",
    steps,
    startedAt: new Date().toISOString(),
  };
}

/**
 * Update the current task step.
 */
export function setAgentStep(task, stepId, status) {
  if (!task || !Array.isArray(task.steps)) {
    return task;
  }

  const allowed = new Set([
    "pending",
    "running",
    "completed",
    "failed",
  ]);

  if (!allowed.has(status)) {
    return task;
  }

  task.steps = task.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          status,
        }
      : step,
  );

  if (status === "running") {
    task.currentStep = stepId;
  }

  return task;
}

/**
 * Stage 1 verification:
 * confirms that the provider actually produced
 * an answer.
 *
 * It does NOT claim to fact-check the answer.
 */
export function verifyAgentOutput(text) {
  const output =
    typeof text === "string"
      ? text.trim()
      : "";

  if (!output) {
    return {
      ok: false,
      reason:
        "The AI provider completed without producing an answer.",
    };
  }

  return {
    ok: true,
    characterCount: output.length,
  };
}