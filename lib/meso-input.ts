import type { ChangeEvent } from "react";

export function parseMesoInput(raw: string): number {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

// 콤마가 실시간으로 추가/제거되면서 커서 위치가 튀는 것을 막기 위해,
// "커서 앞에 있던 숫자 개수"를 기준으로 새로 포맷된 문자열에서 커서 위치를
// 다시 계산해 복원합니다.
export function handleMesoInput(
  e: ChangeEvent<HTMLInputElement>,
  onValue: (value: number) => void
) {
  const input = e.target;
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = input.value.slice(0, caret).replace(/[^0-9]/g, "").length;

  onValue(parseMesoInput(input.value));

  requestAnimationFrame(() => {
    let count = 0;
    let pos = input.value.length;
    for (let i = 0; i < input.value.length; i++) {
      if (/[0-9]/.test(input.value[i])) count++;
      if (count === digitsBeforeCaret) {
        pos = i + 1;
        break;
      }
    }
    if (digitsBeforeCaret === 0) pos = 0;
    input.setSelectionRange(pos, pos);
  });
}
