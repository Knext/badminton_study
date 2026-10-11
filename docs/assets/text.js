// 데이터 텍스트 → 안전한 HTML. 모든 데이터 문자열은 이 모듈을 거친다.
// 규칙(계약 §1): 순수 텍스트, 강조는 **굵게** 만 허용.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);
}

// 이스케이프 후 **…** 만 <b> 로 바꾼다. 짝이 맞지 않는 ** 는 그대로 둔다.
export function rich(value) {
  return esc(value).replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
}

// 강조 기호를 걷어 낸 평문(aria-label·title 용).
export function plain(value) {
  return String(value ?? '').replace(/\*\*([^*]+?)\*\*/g, '$1');
}

// src 배열 → 「매뉴얼 p.154 (PDF 183)」, 여러 개면 쉼표로.
export function srcLabel(src) {
  if (!Array.isArray(src) || src.length === 0) return '';
  const parts = src.map((s) => {
    const printed = s.printed_page != null ? `매뉴얼 p.${s.printed_page}` : '매뉴얼';
    return s.pdf_page != null ? `${printed} (PDF ${s.pdf_page})` : printed;
  });
  return parts.join(', ');
}

// 이스케이프된 HTML 조각을 만드는 태그드 템플릿.
// 보간 값은 기본적으로 이스케이프되고, SafeHTML(html`` 결과 또는 raw()) 만 그대로 들어간다.
// SafeHTML 은 toString() 을 가지므로 innerHTML 에 바로 대입할 수 있다.
class SafeHTML {
  constructor(value) { this.value = String(value); }
  toString() { return this.value; }
}
export function raw(htmlString) {
  return new SafeHTML(htmlString);
}
function piece(v) {
  if (v instanceof SafeHTML) return v.value;
  if (Array.isArray(v)) return v.map(piece).join('');
  if (v === false || v == null) return '';
  return esc(v);
}
export function html(strings, ...values) {
  const out = strings.reduce((acc, str, i) => acc + str + (i < values.length ? piece(values[i]) : ''), '');
  return new SafeHTML(out);
}
// 데이터 텍스트를 강조 변환해 SafeHTML 로.
export function richHTML(value) {
  return new SafeHTML(rich(value));
}

// 가로 스크롤 띠 안에서만 항목을 보이게 한다(scrollIntoView 는 페이지 세로 스크롤까지 움직인다).
export function revealInRow(row, item) {
  if (!row || !item) return;
  const r = row.getBoundingClientRect();
  const it = item.getBoundingClientRect();
  if (it.left < r.left) row.scrollLeft -= r.left - it.left + 8;
  else if (it.right > r.right) row.scrollLeft += it.right - r.right + 8;
}
