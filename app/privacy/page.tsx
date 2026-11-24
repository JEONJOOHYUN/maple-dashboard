import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

// Set to the day this version goes live on main (2026-11-24: sign-in with Google and the kept API keys;
// 2026-11-25: a member's boss revenue settings kept with the account).
const EFFECTIVE_DATE = "2026-11-25";
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
  { company: "Google", job: "구글 로그인 (계정 확인)", place: "미국 등" },
  { company: "Supabase", job: "회원 정보 · 암호화한 API 키 · 보스 수익 설정 보관", place: "한국 (AWS 서울)" },
  { company: "넥슨 (Open API)", job: "닉네임 조회 · 강화 기록 조회 · 등록한 키의 계정 확인 · 숙제 · 보스 수익 조회", place: "한국" },
];

const list = "flex list-disc flex-col gap-1 pl-[18px] text-sm leading-relaxed";
const text = "text-sm leading-relaxed";

export default function PrivacyPage() {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <nav
        aria-label="목차"
        className="flex w-full flex-col gap-1 tile p-4 text-[13px] lg:sticky lg:top-6 lg:w-56"
      >
        <b className="mb-1.5 text-xs text-muted-foreground">목차</b>
        {sections.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            // after: the press area fills the 4px between two lines, never over a neighbour.
            className="relative rounded-md px-2 py-1.5 transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      <article className="flex min-w-0 flex-1 basis-[480px] flex-col gap-6 tile p-5 lg:p-7">
        <header className="flex flex-col gap-1.5 border-b border-border pb-4">
          <h1 className="font-heading text-[22px] leading-tight font-bold lg:text-[26px]">개인정보처리방침</h1>
          <p className="text-[13px] text-muted-foreground">시행 {EFFECTIVE_DATE} · 메이플 대시보드 (비공식 팬 사이트)</p>
        </header>

        <Section index={1} {...sections[0]}>
          <p className={text}>로그인 없이 쓰는 도구는 이름 · 이메일 · 전화번호 안 받음. 로그인 (구글 계정) 은 선택.</p>
          <ul className={list}>
            <li>
              <b>구글 계정 정보</b> (로그인할 때): 이메일 · 이름 · 프로필 사진 주소 → 계정 구분 · 로그인 유지
            </li>
            <li>
              <b>넥슨 Open API 키</b> (내 정보에 등록할 때): 암호화해서 서버에 보관 → 등록한 넥슨 계정의 정보 · 숙제 · 보스 수익 (게임 스케줄러) 조회. 함께 저장 = 넥슨 계정 고유값을 되돌릴 수 없게 바꾼 값 · 대표 캐릭터 이름 · 월드
            </li>
            <li>
              <b>보스 수익 설정</b> (로그인하고 보스 수익을 쓸 때): 고른 캐릭터 (넥슨의 캐릭터 식별값) · 파티원 수 · 고친 보상 가격 · 먹은 보상 표시 → 다른 기기에서 로그인해도 같은 화면
            </li>
            <li>
              <b>방문 기록</b> (자동 수집): 클릭 · 스크롤 · 마우스 움직임, 기기 · 브라우저, 국가, 쿠키 식별자 → 화면 개선
            </li>
            <li>
              <b>캐릭터 닉네임</b> (숨은 스펙업에 입력할 때): 넥슨 Open API 조회
            </li>
            <li>
              <b>넥슨 Open API 키 · 강화 기록</b> (강화 기록에 키를 넣을 때): 브라우저에서 넥슨 서버로 바로 조회. 우리 서버로 안 보내고 저장 안 함
            </li>
            <li>
              <b>아이템 이름 · 레벨 · 그림 주소 · 부위</b> (강화 기록을 볼 때): 공용 아이템 사전에 저장 → 벗거나 판 장비의 그림 · 레벨 표시. 캐릭터 이름 · API 키 · 강화 기록은 안 보냄
            </li>
            <li>
              <b>접속 기록</b> (자동 수집): IP · 요청 주소 · 시각 · 브라우저 → 오류 · 공격 확인
            </li>
            <li>
              <b>시도 횟수</b> (API 키 등록 · 아이템 사전에 보낼 때): IP · 계정을 되돌릴 수 없게 바꾼 값과 횟수 → 지나친 요청 막기
            </li>
          </ul>
        </Section>

        <Section index={2} {...sections[1]}>
          <ul className={list}>
            <li>
              회원 정보 · 등록한 API 키 · 보스 수익 설정: 탈퇴할 때까지. 내 정보의 <b>회원 탈퇴</b>로 전부 바로 삭제, 키는 계정마다 <b>삭제</b> 가능
            </li>
            <li>방문 기록: 녹화 30일 · 집계 13개월 뒤 Clarity 에서 삭제</li>
            <li>닉네임 조회 결과: 서버 임시 캐시. 3시간이 지나면 다음 조회 때 새 결과로 교체, 정해진 삭제 기한 없음 → 요청하면 삭제</li>
            <li>숙제 현황 · 보스 수익 (로그인했을 때): 넥슨에서 받은 숙제 · 보스 기록을 서버 임시 캐시에 5분, 캐릭터 목록 · 캐릭터 그림 주소는 1시간 (API 키는 캐시에 안 들어감). 지나면 다음에 볼 때 새 결과로 교체, 정해진 삭제 기한 없음 → 요청하면 삭제</li>
            <li>접속 기록: Vercel 에서 1시간 뒤 삭제 (현재 요금제 기준)</li>
            <li>아이템 사전: 누구의 것인지 알 수 없는 아이템 정보라 계속 보관</li>
            <li>
              강화 기록에 넣은 API 키 · 강화 기록: 우리 서버에 없음. 브라우저에 저장된 것은 강화 기록의 <b>키 · 기록 지우기</b> 버튼으로 그 키의 것을, 키 입력 화면의 <b>모두 지우기</b>로 전부 삭제
            </li>
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
            <li>Clarity 쿠키: 같은 방문자 구분용. 브라우저에서 차단해도 로그인 없는 도구는 모두 사용 가능</li>
            <li>로그인 쿠키 (로그인했을 때만): 로그인 유지 · 헤더의 로그인 표시. 로그아웃 · 탈퇴하면 삭제</li>
            <li>숙제 현황 쿠키 (캐릭터를 골랐을 때만): 고른 캐릭터를 이 브라우저에 기억. 모두 빼고 저장하면 삭제</li>
            <li>
              계산기 설정 · 입력값: <b>이 브라우저에만</b> 저장, 서버로 안 보냄. 브라우저의 사이트 데이터 삭제로 지움
            </li>
            <li>
              강화 기록: API 키 (기억을 켰을 때, 여러 개 가능) · 키마다 받은 기록 · 장비 레벨 / 노작 가격 입력값 = <b>이 브라우저에만</b> 저장
            </li>
          </ul>
        </Section>

        <Section index={5} {...sections[4]}>
          <p className={text}>
            열람 · 삭제 · 처리 정지 요청 → 아래 이메일. 침해 상담 = 개인정보침해신고센터 (국번 없이 118)
          </p>
        </Section>

        <Section index={6} {...sections[5]}>
          <p className={text}>
            모든 접속 HTTPS. 서버 비밀 키는 서버에만. 등록한 API 키는 암호화 (AES-256-GCM) 해 보관하고 화면에 다시 안 보임. 강화 기록 화면 · 숙제 현황 화면 · 내 정보의 이메일과
            넥슨 계정 · API 키 입력칸은 Clarity 녹화에서 가림.
          </p>
        </Section>

        <Section index={7} {...sections[6]}>
          <p className={text}>
            운영자 (개인정보 보호책임자):{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-sm font-semibold text-primary-text underline underline-offset-2 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className={text}>내용이 바뀌면 시행일과 함께 이 화면에 표시.</p>
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
