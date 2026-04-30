import { Braces, ChevronDown, Code2, FileJson, FileText, Info, Pilcrow, Plus, Search, Sparkles, Type, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Field } from "../ui";
import type { WorkflowVariableGroup, WorkflowVariableOption } from "./workflowVariables";

type InputMode = "plain" | "variable" | "markdown" | "richText" | "json";

const groupLabels: Record<WorkflowVariableGroup, string> = {
  input: "输入变量",
  sys: "系统变量",
  inputs: "流程输入",
  conversation: "会话记录",
  vars: "流程变量",
  nodes: "上游节点",
  metadata: "调用元数据",
};

export function WorkflowConfigInput({
  label,
  hint,
  mode,
  value,
  placeholder,
  variables = [],
  allowVariables = true,
  hideModeToolbar = false,
  onChange,
}: {
  label: string;
  hint?: string;
  mode: InputMode;
  value: string;
  placeholder?: string;
  variables?: WorkflowVariableOption[];
  allowVariables?: boolean;
  hideModeToolbar?: boolean;
  onChange: (value: string) => void;
}) {
  const [activeMode, setActiveMode] = useState<InputMode>(mode);
  const [variableQuery, setVariableQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const modes = useMemo(() => availableModes(mode), [mode]);
  const visibleVariables = useMemo(
    () => filterVariables(variables, variableQuery),
    [variables, variableQuery],
  );

  return (
    <Field label={label}>
      <div className={`workflowConfigInput ${activeMode}`}>
        <div className="configInputMetaRow">
          {!hideModeToolbar && (
            <div className="configInputToolbar" role="tablist" aria-label={`${label} 输入方式`}>
              {modes.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  className={activeMode === item.mode ? "active" : ""}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setActiveMode(item.mode)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
          <div className="configInputTools">
            {hint && (
              <span className="configHintIcon" title={hint} aria-label={hint}>
                <Info size={13} />
              </span>
            )}
            {allowVariables && (
              <VariableReferencePicker
                open={pickerOpen}
                totalCount={variables.length}
                variables={visibleVariables}
                query={variableQuery}
                onOpenChange={setPickerOpen}
                onQueryChange={setVariableQuery}
                onInsert={(path) => {
                  onChange(insertVariable(value, path));
                  setPickerOpen(false);
                  setVariableQuery("");
                }}
              />
            )}
          </div>
        </div>
        {activeMode === "richText" ? (
          <div
            className="richTextSurface"
            contentEditable
            role="textbox"
            aria-label={label}
            data-placeholder={placeholder || "输入富文本内容"}
            suppressContentEditableWarning
            onInput={(event) => onChange(event.currentTarget.innerText)}
          >
            {value}
          </div>
        ) : (
          <textarea
            value={value}
            placeholder={placeholder || modePlaceholder(activeMode)}
            spellCheck={activeMode !== "json"}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </Field>
  );
}

function VariableReferencePicker({
  open,
  totalCount,
  variables,
  query,
  onOpenChange,
  onQueryChange,
  onInsert,
}: {
  open: boolean;
  totalCount: number;
  variables: WorkflowVariableOption[];
  query: string;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onInsert: (path: string) => void;
}) {
  const grouped = groupVariables(variables);
  return (
    <div className="variablePickerWrap" aria-label="可插入变量">
      <div className="variableInsertRow">
        <span title={totalCount ? `${totalCount} 个可引用变量` : "暂无可引用变量"}><Sparkles size={13} /> {totalCount}</span>
        <button
          type="button"
          disabled={!totalCount}
          title="插入变量"
          aria-label="插入变量"
          onClick={() => onOpenChange(!open)}
        >
          <Braces size={13} />
          <ChevronDown size={13} />
        </button>
      </div>
      {open && (
        <div className="variablePicker" role="dialog" aria-label="选择变量">
          <header className="variablePickerHeader">
            <strong>选择变量</strong>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭变量选择器"><X size={13} /></button>
          </header>
          <div className="variablePickerSearch">
            <Search size={13} />
            <input
              autoFocus
              value={query}
              placeholder="搜索变量、节点或字段"
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div className="variableGroupList">
            {Object.entries(grouped).map(([group, items]) => {
              if (!items.length) return null;
              return (
                <section className="variableGroup" key={group}>
                  <strong>{groupLabels[group as WorkflowVariableGroup]}</strong>
                  {items.map((item) => (
                    <button key={item.path} type="button" onClick={() => onInsert(item.path)}>
                      <Plus size={12} />
                      <span>
                        <b>{item.label}</b>
                        <code>{`{{${item.path}}}`}</code>
                      </span>
                      <em>{item.type}</em>
                    </button>
                  ))}
                </section>
              );
            })}
            {!variables.length && <p className="emptyVariableHint">没有匹配的变量。</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function availableModes(mode: InputMode) {
  if (mode === "json") {
    return [{ mode: "json" as const, label: "JSON", icon: <FileJson size={13} /> }];
  }
  if (mode === "variable") {
    return [
      { mode: "variable" as const, label: "变量", icon: <Braces size={13} /> },
      { mode: "plain" as const, label: "文本", icon: <Type size={13} /> },
    ];
  }
  if (mode === "markdown" || mode === "richText") {
    return [
      { mode: "markdown" as const, label: "Markdown", icon: <FileText size={13} /> },
      { mode: "richText" as const, label: "富文本", icon: <Pilcrow size={13} /> },
      { mode: "variable" as const, label: "变量", icon: <Braces size={13} /> },
    ];
  }
  return [{ mode: "plain" as const, label: "文本", icon: <Code2 size={13} /> }];
}

function modePlaceholder(mode: InputMode) {
  if (mode === "variable") return "输入固定值，或插入 {{...}} 变量引用";
  if (mode === "markdown") return "支持 Markdown 内容和变量混排";
  if (mode === "json") return "{\n  \"type\": \"object\"\n}";
  return "请输入内容";
}

function insertVariable(value: string, path: string) {
  return `${value || ""}{{${path}}}`;
}

function filterVariables(variables: WorkflowVariableOption[], query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return variables;
  return variables.filter((item) => (
    item.label.toLowerCase().includes(keyword)
    || item.path.toLowerCase().includes(keyword)
    || item.description.toLowerCase().includes(keyword)
  ));
}

function groupVariables(variables: WorkflowVariableOption[]) {
  return variables.reduce<Record<WorkflowVariableGroup, WorkflowVariableOption[]>>(
    (groups, variable) => {
      groups[variable.group].push(variable);
      return groups;
    },
    { input: [], sys: [], inputs: [], conversation: [], vars: [], nodes: [], metadata: [] },
  );
}
