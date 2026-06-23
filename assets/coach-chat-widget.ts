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
  gender: string;
  yearInCategory: string;
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

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "?";
  }
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase();
}

const RESULT_BADGE_MODIFIER_BY_RESULT: Record<string, string> = {
  Victoire: "result-v",
  Défaite: "result-d"
};

function resultBadgeModifier(result: string): string {
  return RESULT_BADGE_MODIFIER_BY_RESULT[result] || "";
}

const GREETING_MESSAGE = {
  id: "coach-chat-greeting",
  role: "assistant" as const,
  parts: [
    {
      type: "text" as const,
      text: "Mode bêta. Essaie : « Trouve les judokas qui ont gagné par Hon-gesa-gatame »."
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

function renderMatchAvatar(match: CoachMatch): VNode | null {
  if (!match.judokaId) {
    return null;
  }
  return h("span", { class: "hero-avatar coach-assistant-avatar", "aria-hidden": "true" }, getInitials(match.judokaName));
}

function renderMatchBeltChip(match: CoachMatch): VNode | null {
  if (!match.judokaId || !match.beltColor) {
    return null;
  }
  const emoji = getBeltEmoji(match.beltColor);
  return h("span", { class: "result-badge" }, emoji ? `${emoji} ${match.beltColor}` : match.beltColor);
}

function renderMatchAgeCategoryChip(match: CoachMatch, hasCombatData: boolean): VNode | null {
  if (hasCombatData || !match.scoreLabel) {
    return null;
  }
  return h("span", { class: "result-badge" }, match.scoreLabel);
}

function renderMatchYearInCategoryChip(match: CoachMatch): VNode | null {
  if (!match.judokaId || !match.yearInCategory) {
    return null;
  }
  return h("span", { class: "result-badge" }, match.yearInCategory);
}

function renderMatchGenderChip(match: CoachMatch): VNode | null {
  if (!match.judokaId || !match.gender) {
    return null;
  }
  return h("span", { class: "result-badge" }, match.gender);
}

function renderMatchOutcome(match: CoachMatch): VNode {
  const detailParts = [match.opponent ? `contre ${match.opponent}` : null, match.victoryType, match.scoreLabel].filter(
    (part): part is string => Boolean(part)
  );
  return h("div", { class: "coach-assistant-outcome" }, [
    match.result
      ? h("span", { class: `result-badge ${resultBadgeModifier(match.result)}`.trim() }, match.result)
      : null,
    detailParts.length ? h("span", { class: "coach-assistant-outcome-detail" }, detailParts.join(" · ")) : null
  ]);
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
  const hasCombatData = Boolean(match.result || match.opponent);
  const chips = [
    renderMatchAgeCategoryChip(match, hasCombatData),
    renderMatchYearInCategoryChip(match),
    renderMatchGenderChip(match),
    renderMatchBeltChip(match)
  ].filter((chip): chip is VNode => chip !== null);
  const cardClass = match.judokaId ? "coach-assistant-result coach-assistant-result-judoka" : "coach-assistant-result";
  return h("div", { key, class: cardClass }, [
    h("div", { class: "coach-assistant-result-head" }, [
      renderMatchAvatar(match),
      h("div", { class: "coach-assistant-result-heading-group" }, [
        renderMatchHeading(match, onSelectJudoka, onSelectCompetition),
        chips.length ? h("div", { class: "coach-assistant-result-chips" }, chips) : null
      ])
    ]),
    renderMatchCompetitionLabel(match, onSelectCompetition),
    hasCombatData ? renderMatchOutcome(match) : null
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
                  placeholder: "Ex. Trouve les judokas qui ont gagné par Hon-gesa-gatame",
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
