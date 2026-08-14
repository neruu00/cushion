/**
 * @file components/Field.tsx
 * @description 라벨 + 입력 한 쌍. 폼마다 베끼던 것을 한곳에 뒀다.
 *
 * 같은 name의 필드가 화면에 여러 번 나올 수 있으므로(라이브러리 카드마다 멤버 폼) id를 쓰지 않는다.
 * label로 감싸면 id 없이 연결되고, 중복 id를 만들 여지가 아예 없어진다.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldProps {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  /**
   * 값이 여러 개일 수 있는 칸. 한 줄짜리 input이면 Enter가 줄을 추가하는 대신 폼을 제출하고,
   * 그래서 화면이 "값은 하나"라고 말하게 된다 — 여러 개를 받는 칸에는 거짓말이다.
   */
  multiline?: boolean;
  hint?: string;
}

export function Field({
  name,
  label,
  placeholder,
  type = "text",
  required,
  defaultValue,
  multiline,
  hint,
}: FieldProps) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      {multiline ? (
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          spellCheck={false}
          rows={3}
          className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <Input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
        />
      )}
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </Label>
  );
}
