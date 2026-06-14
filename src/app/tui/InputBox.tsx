import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { filterSlashCommands, type SlashCommand } from "./slash-commands.js";

type InputBoxProps = {
  commands: SlashCommand[];
  disabled: boolean;
  onSubmit: (value: string) => void;
  lastInput?: string | undefined;
};

const MAX_VISIBLE_COMMANDS = 6;

export function InputBox({
  commands,
  disabled,
  onSubmit,
  lastInput,
}: InputBoxProps): JSX.Element {
  const [state, setState] = useState({ value: "", cursorPos: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const value = state.value;
  const cursorPos = state.cursorPos;

  const commandSuggestions = useMemo(() => {
    return filterSlashCommands(value, commands).slice(0, MAX_VISIBLE_COMMANDS);
  }, [commands, value]);

  const showCommandSuggestions = !disabled && value.startsWith("/");

  function updateValue(nextValue: string, nextCursor?: number): void {
    setState({ value: nextValue, cursorPos: nextCursor ?? nextValue.length });
    setSelectedIndex(0);
  }

  function submitCurrentValue(): void {
    const selectedCommand = commandSuggestions[selectedIndex];
    const submitted = selectedCommand?.name ?? value.trim();
    updateValue("", 0);

    if (submitted) {
      onSubmit(submitted);
    }
  }

  function completeSelectedCommand(): void {
    const selectedCommand = commandSuggestions[selectedIndex];

    if (selectedCommand) {
      updateValue(selectedCommand.name);
    }
  }

  useInput(
    (input, key) => {
      if (disabled) {
        return;
      }

      if (key.return) {
        submitCurrentValue();
        return;
      }

      // ── Cursor movement ────────────────────────────

      if (key.leftArrow) {
        setState((prev) => ({ ...prev, cursorPos: Math.max(0, prev.cursorPos - 1) }));
        return;
      }

      if (key.rightArrow) {
        setState((prev) => ({ ...prev, cursorPos: Math.min(prev.value.length, prev.cursorPos + 1) }));
        return;
      }

      // Ctrl+A — move to start of line
      if (key.ctrl && (input === "a" || input === "A")) {
        setState((prev) => ({ ...prev, cursorPos: 0 }));
        return;
      }

      // Ctrl+E — move to end of line
      if (key.ctrl && (input === "e" || input === "E")) {
        setState((prev) => ({ ...prev, cursorPos: prev.value.length }));
        return;
      }

      // Ctrl+K — delete from cursor to end of line
      if (key.ctrl && (input === "k" || input === "K")) {
        setState((prev) => ({ value: prev.value.slice(0, prev.cursorPos), cursorPos: prev.cursorPos }));
        return;
      }

      // Ctrl+U — delete from start to cursor
      if (key.ctrl && (input === "u" || input === "U")) {
        setState((prev) => ({ value: prev.value.slice(prev.cursorPos), cursorPos: 0 }));
        return;
      }

      // ── Command suggestion navigation ──────────────

      if (showCommandSuggestions && key.upArrow) {
        setSelectedIndex((current) =>
          commandSuggestions.length === 0
            ? 0
            : (current - 1 + commandSuggestions.length) % commandSuggestions.length,
        );
        return;
      }

      if (showCommandSuggestions && key.downArrow) {
        setSelectedIndex((current) =>
          commandSuggestions.length === 0 ? 0 : (current + 1) % commandSuggestions.length,
        );
        return;
      }

      if (showCommandSuggestions && (key.tab || key.rightArrow)) {
        completeSelectedCommand();
        return;
      }

      // ── Recalling last input ───────────────────────

      if (key.upArrow && !showCommandSuggestions && value === "" && lastInput) {
        updateValue(lastInput);
        return;
      }

      // ── Delete operations ──────────────────────────

      // Backspace: delete character before cursor
      if (key.backspace || input === "\x08" || input === "\x7f") {
        setState((prev) => {
          if (prev.cursorPos === 0) return prev;
          return {
            value: prev.value.slice(0, prev.cursorPos - 1) + prev.value.slice(prev.cursorPos),
            cursorPos: prev.cursorPos - 1,
          };
        });
        return;
      }

      // Delete / Del key: delete character before cursor when at end
      // (many terminals map Backspace → Delete), otherwise delete after.
      if (key.delete || input === "\x1b[3~") {
        setState((prev) => {
          // At end of line → act like backspace (delete before cursor)
          if (prev.cursorPos === prev.value.length && prev.cursorPos > 0) {
            return {
              value: prev.value.slice(0, prev.cursorPos - 1) + prev.value.slice(prev.cursorPos),
              cursorPos: prev.cursorPos - 1,
            };
          }
          // Otherwise → delete after cursor
          if (prev.cursorPos < prev.value.length) {
            return {
              value: prev.value.slice(0, prev.cursorPos) + prev.value.slice(prev.cursorPos + 1),
              cursorPos: prev.cursorPos,
            };
          }
          return prev;
        });
        return;
      }

      // ── Regular text input ─────────────────────────

      // Only accept printable characters (skip control chars / escape sequences)
      if (!key.ctrl && !key.meta && input && !/[\x00-\x1f\x7f]/.test(input) && input.charAt(0) !== "\x1b") {
        setState((prev) => {
          const chars = input;
          return {
            value: prev.value.slice(0, prev.cursorPos) + chars + prev.value.slice(prev.cursorPos),
            cursorPos: prev.cursorPos + chars.length,
          };
        });
      }
    },
    { isActive: !disabled },
  );

  // Visual cursor: invert the character at cursor position
  const cursorChar = value[cursorPos] ?? " ";
  const beforeCursor = value.slice(0, cursorPos);
  const afterCursor = value.slice(cursorPos + 1);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text color={disabled ? "gray" : "green"}>Input &gt; </Text>
        {disabled ? (
          <Text color="gray">Agent 正在执行...</Text>
        ) : (
          <>
            <Text>{beforeCursor}</Text>
            <Text inverse>{cursorChar}</Text>
            <Text>{afterCursor}</Text>
          </>
        )}
      </Box>
      {showCommandSuggestions ? (
        <Box flexDirection="column" paddingX={1}>
          {commandSuggestions.length > 0 ? (
            commandSuggestions.map((command, index) => (
              <Text
                key={command.name}
                color={index === selectedIndex ? "cyan" : "gray"}
                inverse={index === selectedIndex}
              >
                {index === selectedIndex ? "> " : "  "}
                {command.name.padEnd(8)} {command.description}
              </Text>
            ))
          ) : (
            <Text color="gray">  未找到匹配命令</Text>
          )}
          <Text color="gray">  ↑/↓ 选择，Tab/→ 补全，Enter 执行</Text>
        </Box>
      ) : null}
    </Box>
  );
}
