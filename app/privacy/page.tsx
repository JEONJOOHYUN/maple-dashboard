import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

// Set to the day this version goes live on main.
const EFFECTIVE_DATE = "2026-11-11";
const CONTACT_EMAIL = "maplestorydashboard@gmail.com";

const sections = [
  { id: "items", title: "처리 항목 · 목적" },
  { id: "retention", title: "보유 기간 · 파기" },
  { id: "third-party", title: "외부 서비스 · 국외 이전" },
  { id: "storage", title: "쿠키 · 브라우저 저장" },
  { id: "rights", title: "이용자 권리" },
  { id: "safety", title: "안전 조치" },
  { id: "contact", title: "문의 · 변경" },
];

const processors = [
  { company: "Microsoft (Clarity)", job: "방문 기록 분석", place: "미국 등 (Microsoft Azure)" },
  { company: "Vercel", job: "호스팅 · 접속 기록", place: "미국 (함수 실행은 서울)" },
  { company: "넥슨 (Open API)", job: "닉네임 조회", place: "한국" },
];

const list = "flex list-disc flex-col gap-1 pl-[18px] text-sm leading-relaxed";
const text = "text-sm leading-relaxed";

export default function PrivacyPage() {
  return (
    <div className="flex flex-wrap items-start gap-5 lg:gap-7">
      <nav
        aria-label="목차"
        className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-4 text-[13px] lg:sticky lg:top-6 lg:w-56"
      >
        <b className="mb-1.5 text-xs text-muted-foreground">목차</b>
        {sections.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      <article className="flex min-w-0 flex-1 basis-[480px] flex-col gap-6 rounded-lg border border-border bg-card p-5 lg:p-7">
        <header className="flex flex-col gap-1.5 border-b border-border pb-4">
          <h1 className="font-heading text-[22px] leading-tight font-bold lg:text-[26px]">개인정보처리방침</h1>
          <p className="text-[13px] text-muted-foreground">시행 {EFFECTIVE_DATE} · 메이플 대시보드 (비공식 팬 사이트)</p>
        </header>

        <Section index={1} {...sections[0]}>
          <p className={text}>회원 가입 없음. 이름 · 이메일 · 전화번호 안 받음.</p>
          <ul className={list}>
            <li>
              <b>방문 기록</b> (자동 수집): 클릭 · 스크롤 · 마우스 움직임, 기기 · 브라우저, 국가, 쿠키 식별자 → 화면 개선
            </li>
            <li>
              <b>캐릭터 닉네임</b> (숨은 스펙업에 입력할 때): 넥슨 Open API 조회
            </li>
            <li>
              <b>접속 기록</b> (자동 수집): IP · 요청 주소 · 시각 · 브라우저 → 오류 · 공격 확인
            </li>
          </ul>
        </Section>

        <Section index={2} {...sections[1]}>
          <ul className={list}>
            <li>방문 기록: 녹화 30일 · 집계 13개월 뒤 Clarity 에서 삭제</li>
            <li>닉네임 조회 결과: 서버 임시 캐시. 3시간이 지나면 다음 조회 때 새 결과로 교체, 정해진 삭제 기한 없음 → 요청하면 삭제</li>
            <li>접속 기록: Vercel 에서 1시간 뒤 삭제 (현재 요금제 기준)</li>
          </ul>
        </Section>

        <Section index={3} {...sections[2]}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left text-[13px] leading-relaxed">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">회사</th>
                  <th className="px-3 py-2 font-semibold">맡긴 일</th>
                  <th className="px-3 py-2 font-semibold">나라</th>
                </tr>
              </thead>
              <tbody>
                {processors.map((p) => (
                  <tr key={p.company} className="border-t border-border">
                    <td className="px-3 py-2">{p.company}</td>
                    <td className="px-3 py-2">{p.job}</td>
                    <td className="px-3 py-2">{p.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-muted-foreground">
            판매 · 광고용 제공 없음. 숨은 스펙업의 캐릭터 그림은 넥슨 서버에서 바로 불러옴.
          </p>
        </Section>

        <Section index={4} {...sections[3]}>
          <ul className={list}>
            <li>Clarity 쿠키: 같은 방문자 구분용. 브라우저에서 차단해도 모든 도구 사용 가능</li>
            <li>
              계산기 설정 · 입력값: <b>이 브라우저에만</b> 저장, 서버로 안 보냄. 브라우저의 사이트 데이터 삭제로 지움
            </li>
          </ul>
        </Section>

        <Section index={5} {...sections[4]}>
          <p className={text}>
            열람 · 삭제 · 처리 정지 요청 → 아래 이메일. 침해 상담 = 개인정보침해신고센터 (국번 없이 118)
          </p>
        </Section>

        <Section index={6} {...sections[5]}>
          <p className={text}>모든 접속 HTTPS. 서버 비밀 키는 서버에만.</p>
        </Section>

        <Section index={7} {...sections[6]}>
          <p className={text}>
            운영자 (개인정보 보호책임자):{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-primary-text underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className={text}>회원 가입 · API 키 기능을 열기 전에 이 문서부터 고치고 시행일 표시.</p>
        </Section>
      </article>
    </div>
  );
}

function Section({
  index,
  id,
  title,
  children,
}: {
  index: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-2">
      <h2 className="font-heading text-[17px] font-bold">
        {index}. {title}
      </h2>
      {children}
    </section>
  );
}
