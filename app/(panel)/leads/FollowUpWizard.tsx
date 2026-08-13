"use client";

import { useActionState, useState } from "react";

import { logFollowUpAction } from "@/app/(panel)/leads/actions";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/classNames";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { addDays, toFollowUpInputValue } from "@/lib/leads/followUp";
import { CONTACT_LIMITS } from "@/lib/validation/contactSchemas";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

/** How far ahead the date step's shortcuts jump. */
const DATE_SHORTCUTS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

const STEPS = ["What you did", "How it went", "Where it stands", "What's next"] as const;

export interface WizardStage {
  id: string;
  label: string;
  kind: string;
}

/**
 * The follow-up wizard.
 *
 * Four steps in one dialog, ending in a review — then a single Server Action writes the attempt,
 * the stage move and the next due date inside one transaction. The steps exist because logging a
 * call and deciding what happens to the lead are different questions, and the old flat form asked
 * neither of the last two at all: a lead could be phoned twenty times without ever moving or
 * being scheduled.
 */
export function FollowUpWizard({
  contactId,
  contactName,
  channels,
  outcomes,
  stages,
  currentStageId,
}: {
  contactId: string;
  contactName: string;
  channels: { id: string; label: string }[];
  outcomes: { id: string; label: string }[];
  stages: WizardStage[];
  currentStageId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(logFollowUpAction, IDLE_FORM_STATE);
  const [step, setStep] = useState(0);

  const [channel, setChannel] = useState(channels[0]?.label ?? "");
  const [outcome, setOutcome] = useState(outcomes[0]?.label ?? "");
  const [stageId, setStageId] = useState(currentStageId);
  const [followUpDate, setFollowUpDate] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  // Close and reset once the action reports success, so a filled-in form isn't left behind to be
  // resubmitted as a second identical attempt.
  //
  // Adjusted during render rather than in an effect: React re-renders immediately without
  // painting the stale frame, whereas an effect would flash the completed form for a tick before
  // clearing it. Guarded by the last state object seen, so it runs once per action result.
  const [handledState, setHandledState] = useState(state);

  if (handledState !== state) {
    setHandledState(state);

    if (state.status === "success") {
      setIsOpen(false);
      setStep(0);
      setFollowUpDate("");
      setNote("");
      setReason("");
      setStageId(currentStageId);
    }
  }

  if (channels.length === 0 || outcomes.length === 0) {
    return (
      <p className="text-xs text-muted">
        An admin needs to add at least one channel and one outcome under Settings before follow-ups
        can be logged.
      </p>
    );
  }

  const targetStage = stages.find((stage) => stage.id === stageId);
  const isMovingStage = stageId !== currentStageId;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">Log follow-up</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Follow up with {contactName}</DialogTitle>
          <DialogDescription className="text-xs">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-1" aria-label="Progress">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors duration-200",
                index <= step ? "bg-accent" : "bg-border-strong",
              )}
            />
          ))}
        </ol>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="outcome" value={outcome} />
          <input type="hidden" name="stageId" value={isMovingStage ? stageId : ""} />
          <input type="hidden" name="nextFollowUpDate" value={followUpDate} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="reason" value={isMovingStage ? reason : ""} />

          <FormMessage status={state.status} message={state.message} />

          {step === 0 && (
            <ChoiceList
              label="How did you reach out?"
              options={channels.map((entry) => entry.label)}
              value={channel}
              onChange={setChannel}
            />
          )}

          {step === 1 && (
            <ChoiceList
              label="How did it go?"
              options={outcomes.map((entry) => entry.label)}
              value={outcome}
              onChange={setOutcome}
            />
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <ChoiceList
                label="Where does that leave them?"
                options={stages.map((stage) => stage.label)}
                value={targetStage?.label ?? ""}
                onChange={(label) => {
                  const chosen = stages.find((stage) => stage.label === label);
                  setStageId(chosen?.id ?? currentStageId);
                }}
                hint={
                  isMovingStage
                    ? undefined
                    : "Leaving it where it is is a normal answer — not every call moves a lead."
                }
              />

              {isMovingStage && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted">
                    Why (optional)
                  </span>
                  <input
                    type="text"
                    value={reason}
                    maxLength={CONTACT_LIMITS.stageReason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Budget confirmed, waiting on their legal team…"
                    className={CONTROL_CLASSES}
                  />
                </label>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted">
                  When should someone chase this?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_SHORTCUTS.map((shortcut) => {
                    const value = toFollowUpInputValue(addDays(new Date(), shortcut.days));

                    return (
                      <button
                        key={shortcut.label}
                        type="button"
                        onClick={() => setFollowUpDate(value)}
                        className={cn(
                          "rounded-sm border px-2 py-1 text-[11px] transition-colors duration-150",
                          followUpDate === value
                            ? "border-accent text-accent"
                            : "border-border-strong text-muted hover:text-fg",
                        )}
                      >
                        {shortcut.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFollowUpDate("")}
                    className={cn(
                      "rounded-sm border px-2 py-1 text-[11px] transition-colors duration-150",
                      followUpDate === ""
                        ? "border-accent text-accent"
                        : "border-border-strong text-muted hover:text-fg",
                    )}
                  >
                    Nothing booked
                  </button>
                </div>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(event) => setFollowUpDate(event.target.value)}
                  aria-label="Follow-up date"
                  className={CONTROL_CLASSES}
                />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.14em] text-muted">
                  What happened (optional)
                </span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Anything the next person picking this up needs to know."
                  className={`${CONTROL_CLASSES} resize-y leading-relaxed`}
                />
              </label>

              <dl className="flex flex-col gap-1 rounded-sm border border-border bg-card px-3 py-2.5 text-xs">
                <ReviewRow label="Channel" value={channel} />
                <ReviewRow label="Outcome" value={outcome} />
                <ReviewRow
                  label="Stage"
                  value={
                    isMovingStage ? `moving to ${targetStage?.label}` : "unchanged"
                  }
                />
                <ReviewRow
                  label="Next"
                  value={followUpDate ? formatReviewDate(followUpDate) : "nothing booked"}
                />
              </dl>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 0 ? setIsOpen(false) : setStep(step - 1))}
            >
              {step === 0 ? "Cancel" : "Back"}
            </Button>

            {isLastStep ? (
              <SubmitButton pendingLabel="Saving…" variant="primary">
                Save follow-up
              </SubmitButton>
            ) : (
              <Button type="button" variant="primary" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}

function ChoiceList({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">{label}</legend>

      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-sm border px-3 py-2 text-sm transition-colors duration-150",
              value === option
                ? "border-accent/50 bg-accent/5 text-fg"
                : "border-border text-muted hover:border-border-strong hover:text-fg",
            )}
          >
            <input
              type="radio"
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                value === option ? "bg-accent" : "bg-border-strong",
              )}
            />
            {option}
          </label>
        ))}
      </div>

      {hint && <p className="text-[11px] leading-relaxed text-muted">{hint}</p>}
    </fieldset>
  );
}

function formatReviewDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
