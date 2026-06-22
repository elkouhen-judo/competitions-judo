import { createApp, h, Fragment, ref, type VNode } from "vue";
import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport, type UIMessage } from "ai";

interface MountCoachChatWidgetOptions {
  elementId: string;
  getAccessToken: () => Promise<string>;
}

interface CoachMatch {
  judokaId: string;
  judokaName: string;
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  opponent: string;
  result: string;
  victoryType: string;
  scoreLabel: string;
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

function renderMatchCard(match: CoachMatch): VNode {
  const key = `${match.competitionId}-${match.judokaId}-${match.opponent}-${match.scoreLabel}`;
  return h("div", { key, class: "coach-assistant-result" }, [
    h("strong", null, match.judokaName),
    match.competitionName || match.competitionDate
      ? h("span", null, [
          match.competitionName,
          match.competitionName && match.competitionDate ? " · " : "",
          match.competitionDate
        ])
      : null,
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

function renderMessagePart(part: UIMessage["parts"][number], index: number): VNode | null {
  if (part.type === "text") {
    return h("p", { key: index }, part.text);
  }
  if (part.type === "data-coachMatches") {
    const matches = (part as { data: CoachMatch[] }).data;
    if (Array.isArray(matches) && matches.length) {
      return h(
        "div",
        { key: index, class: "coach-assistant-results" },
        matches.map(renderMatchCard)
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
                message.parts.map((part, index) => renderMessagePart(part, index))
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
