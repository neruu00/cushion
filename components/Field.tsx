/**
 * @file components/Field.tsx
 * @description 라벨 + 입력 한 쌍. 폼마다 베끼던 것을 한곳에 뒀다.
 *
 * 같은 name의 필드가 화면에 여러 번 나올 수 있으므로(레포 카드마다 멤버 폼) id를 쓰지 않는다.
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
}

export function Field({ name, label, placeholder, type = "text", required }: FieldProps) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      <Input name={name} type={type} placeholder={placeholder} required={required} />
    </Label>
  );
}
