import { createApp, h, Fragment, ref, type VNode } from "vue";
import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport, type UIMessage } from "ai";

interface MountCoachChatWidgetOptions {
  elementId: string;
  getAccessToken: () => Promise<string>;
  onSelectJudoka: (judokaId: string) => void;
  onSelectCompetition: (competitionId: string) => void;
}

interface CoachMatch {
  judokaId: string;
  judokaName: string;
  beltColor: string;
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  opponent: string;
  result: string;
  victoryType: string;
  scoreLabel: string;
}

const BELT_EMOJI_BY_BASE_COLOR: Record<string, string> = {
  Blanc: "⚪",
  Jaune: "🟡",
  Orange: "🟠",
  Vert: "🟢",
  Bleu: "🔵",
  Marron: "🟤",
  Noir: "⚫"
};

function getBeltEmoji(beltColor: string): string {
  const baseColor = beltColor.replace(/\s+\d+e?r?\s+Dan$/i, "");
  return baseColor
    .split("-")
    .map((color) => BELT_EMOJI_BY_BASE_COLOR[color.trim()])
    .filter(Boolean)
    .join("");
}

const GREETING_MESSAGE = {
  id: "coach-chat-greeting",
  role: "assistant" as const,
  parts: [
    {
      type: "text" as const,
      text: "Mode bêta. Essaie : « Trouve les judokas qui ont gagné par Osaekomi »."
    }
  ]
};

function renderMatchHeading(
  match: CoachMatch,
  onSelectJudoka: (judokaId: string) => void,
  onSelectCompetition: (competitionId: string) => void
): VNode {
  if (match.judokaId) {
    return h(
      "button",
      {
        type: "button",
        class: "coach-assistant-result-name",
        onClick: () => onSelectJudoka(match.judokaId)
      },
      match.judokaName
    );
  }
  if (match.competitionId) {
    return h(
      "button",
      {
        type: "button",
        class: "coach-assistant-result-name",
        onClick: () => onSelectCompetition(match.competitionId)
      },
      match.judokaName
    );
  }
  return h("strong", null, match.judokaName);
}

function renderMatchBeltBadge(match: CoachMatch): VNode | null {
  if (!match.judokaId || !match.beltColor) {
    return null;
  }
  const emoji = getBeltEmoji(match.beltColor);
  return h("span", { class: "coach-assistant-result-belt" }, emoji ? `${emoji} ${match.beltColor}` : match.beltColor);
}

function renderMatchCompetitionLabel(
  match: CoachMatch,
  onSelectCompetition: (competitionId: string) => void
): VNode | null {
  if (!match.competitionName && !match.competitionDate) {
    return null;
  }
  const content = [
    match.competitionName,
    match.competitionName && match.competitionDate ? " · " : "",
    match.competitionDate
  ];
  // The competition is already the clickable heading when there's no judoka on the row
  // (competition-entity matches) — only add a second click target when judoka owns the heading.
  if (match.judokaId && match.competitionId) {
    return h(
      "button",
      {
        type: "button",
        class: "coach-assistant-result-competition",
        onClick: () => onSelectCompetition(match.competitionId)
      },
      content
    );
  }
  return h("span", null, content);
}

function renderMatchCard(
  match: CoachMatch,
  onSelectJudoka: (judokaId: string) => void,
  onSelectCompetition: (competitionId: string) => void
): VNode {
  const key = `${match.competitionId}-${match.judokaId}-${match.opponent}-${match.scoreLabel}`;
  return h("div", { key, class: "coach-assistant-result" }, [
    renderMatchHeading(match, onSelectJudoka, onSelectCompetition),
    renderMatchBeltBadge(match),
    renderMatchCompetitionLabel(match, onSelectCompetition),
    match.result || match.opponent
      ? h("span", null, [
          match.result,
          match.result && match.opponent ? " contre " : "",
          match.opponent,
          match.victoryType ? ` · ${match.victoryType}` : ""
        ])
      : null,
    match.scoreLabel ? h("span", null, match.scoreLabel) : null
  ]);
}

function renderMessagePart(
  part: UIMessage["parts"][number],
  index: number,
  onSelectJudoka: (judokaId: string) => void,
  onSelectCompetition: (competitionId: string) => void
): VNode | null {
  if (part.type === "text") {
    return h("p", { key: index }, part.text);
  }
  if (part.type === "data-coachMatches") {
    const matches = (part as { data: CoachMatch[] }).data;
    if (Array.isArray(matches) && matches.length) {
      return h(
        "div",
        { key: index, class: "coach-assistant-results" },
        matches.map((match) => renderMatchCard(match, onSelectJudoka, onSelectCompetition))
      );
    }
  }
  return null;
}

function mountKirokuCoachChatWidget(options: MountCoachChatWidgetOptions) {
  const app = createApp({
    setup() {
      const chat = new Chat<UIMessage>({
        messages: [GREETING_MESSAGE],
        transport: new DefaultChatTransport({
          api: "/api/coach-chat",
          headers: async () => ({
            Authorization: `Bearer ${await options.getAccessToken()}`
          })
        })
      });
      const question = ref("");

      function submit() {
        const text = question.value.trim();
        if (!text || chat.status !== "ready") {
          return;
        }
        chat.sendMessage({ text });
        question.value = "";
      }

      return () =>
        h(Fragment, null, [
          h("div", { class: "coach-assistant-thread" }, [
            ...chat.messages.map((message) =>
              h(
                "article",
                {
                  key: message.id,
                  class: [
                    "coach-assistant-message",
                    message.role === "user"
                      ? "coach-assistant-message-user"
                      : "coach-assistant-message-system"
                  ]
                },
                message.parts.map((part, index) =>
                  renderMessagePart(part, index, options.onSelectJudoka, options.onSelectCompetition)
                )
              )
            ),
            chat.status === "submitted" || chat.status === "streaming"
              ? h("div", { class: "coach-assistant-loading" }, "Recherche en cours...")
              : null,
            chat.error ? h("p", { class: "coach-assistant-error" }, chat.error.message) : null
          ]),
          h(
            "form",
            {
              class: "coach-assistant-form",
              onSubmit: (event: Event) => {
                event.preventDefault();
                submit();
              }
            },
            [
              h("label", { for: "coachAssistantQuestion" }, "Question"),
              h("div", { class: "coach-assistant-input-row" }, [
                h("input", {
                  id: "coachAssistantQuestion",
                  type: "search",
                  autocomplete: "off",
                  placeholder: "Ex. Trouve les judokas qui ont gagné par Osaekomi",
                  value: question.value,
                  onInput: (event: Event) => {
                    question.value = (event.target as HTMLInputElement).value;
                  }
                }),
                h(
                  "button",
                  { type: "submit", disabled: chat.status !== "ready" || !question.value.trim() },
                  "Rechercher"
                )
              ])
            ]
          )
        ]);
    }
  });
  app.mount(`#${options.elementId}`);
}

window.mountKirokuCoachChatWidget = mountKirokuCoachChatWidget;

declare global {
  interface Window {
    mountKirokuCoachChatWidget: typeof mountKirokuCoachChatWidget;
  }
}
