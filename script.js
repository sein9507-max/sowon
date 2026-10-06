/* 소원저장소 — 대본 만들기 · 완성대본목록
 * 대본 규칙: 인기 릴스 대본 76편 분석(레퍼런스_인기대본_문장구조_v2) + 2026-10-06 재검증
 * Claude 호출: 대본·다듬기 = Claude Fable 5.1, 후킹 후보 = Claude Sonnet 5.5, 메모→주제 = Claude Haiku 4.5
 * 완성 대본은 GitHub 비공개 저장소의 <아이디어뇌>/대본/<YYYY-MM>.json 에 쌓는다(아이디어와 같은 열쇠).
 * Claude 열쇠는 이 기기의 localStorage 에만 둔다. api.anthropic.com 외에는 보내지 않는다.
 * 이 파일은 _design/script_src.js 에서 만들어진다 — 고칠 때는 그 파일을 고치고 _design/build_script.py 를 돌린다. */
import Anthropic from './vendor/anthropic-sdk.mjs';

const M_BEST = 'claude-fable-5-1';
const M_MID = 'claude-sonnet-5-5';
const M_QUICK = 'claude-haiku-4-5';
const FIRST_MONTH = '2026-10';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
};
const pad = (n) => String(n).padStart(2, '0');
const SW = window.sowon;   // app.js 가 열어 둔 다리
const toast = (m) => SW.toast(m);
const localISO = (d = new Date()) => SW.isoLocal(d);
const today = () => localISO().slice(0, 10);
function fmtDate(at) { if (!at) return ''; return `${Number(at.slice(5, 7))}/${Number(at.slice(8, 10))} ${at.slice(11, 16)}`; }

// ── 대본 규칙 v2 (2026-10-06 저녁) ─────────────────────────
// v1 문제: ① 대강 대본을 '재료'로만 보고 통째로 다시 씀 ② 레퍼런스는 3편을 한 줄로 뭉개 넣고 규칙이 90%
// ③ "확인한 숫자만 쓸 수 있다"가 대강 대본 속 숫자까지 지움 ④ JSON 조각으로 쓰게 해서 말 흐름이 끊김
// v2: 원문 34편을 그대로 레퍼런스로 넣고, 대강 대본 우선, 원문과 같은 '슬롯) 문장 ( 화면 )' 글로 받고, 두 버전(살림/레퍼런스식)을 낸다.
const STRUCTS = {
  "문제해결형": { slots: ["후킹","베네핏 - 주제","공감유도 or 문제점 제시","문제해결","포모형성 or 혜택 강조","CTA"] },
  "혜택강조형": { slots: ["후킹","주제 - 베네핏","혜택나열","포모형성 or 혜택 강조","CTA"] },
  "n가지형":   { slots: ["후킹","베네핏 - 주제 + n가지","문제점 제시","첫 번째","두 번째","세 번째","CTA"] }
};
const HOOKS = [
  ["금액 제시", "[대상]은 [금액] 받아가세요!!", "2030은 6월에 3천만 원 받아가세요!!"],
  ["부정·경고", "아직도 ○○ 하시는 거 아니시죠?", "아직도 카카오뱅크·토스만 쓰시는 거 아니시죠?"],
  ["뉴스·속보", "○○ 한 번 더 열린대요!!", "19% 적금 놓친 분들, 한 번 더 열린대요!!"],
  ["조건 제시", "[조건]이라면 무조건 ○○하세요", "연봉 5천만 원 이하면 무조건 신청하세요!"],
  ["질문·호기심", "○○만 하면 나라에서 ○○까지?", "50만 원씩만 저축하면 나라에서 4천만 원까지?"],
  ["마감 압박", "두 달 뒤면 사라진대요", "일하면서 낸 세금, 두 달 뒤면 소멸된대요"],
  ["선언·단정", "그냥 딱 정해드릴게요", "미국 주식 그냥 딱 정해드릴게요"],
  ["가림말 지시형", "[대상]은 이거 무조건 ○○하세요!", "체크카드는 제발 이거 쓰세요!"],
  ["부자 따라가기", "상위 1%는 전부 이걸로 갈아타고 있대요", "상위 1% 부자들은 전부 이걸로 갈아타고 있대요!"],
  ["위로·반전", "○○라고 슬퍼하지 마세요! 그거 아직 ○○ 아니에요", "주식 파란불이라고 슬퍼하지 마세요! 그거 아직 내 돈 아니에요."],
  ["시즌 알림", "[시기]엔 [대상] ○○ 싹 다 챙기세요!!", "10월엔 2030 지원금 싹 다 챙기세요!!"],
  ["1인칭 사례", "저 ○○ ○○만 원 받을 수 있대요!!", "저 연말정산 374만 원 받을 수 있대요!!"]
];
const TONES = {
  "보보스식 요체": "레퍼런스 대본 그대로의 친근한 존댓말. 시키고(~세요) 이유 대고(~거든요) 확인하고(~잖아요, ~죠?) 전해 듣는(~대요) 말끝을 섞는다.",
  "민팀장 리듬 요체": "명사로 끊고 !!를 붙이는 짧은 끊어 치기(\"12월 청년혜택 탑 5!\"), 딱 N가지, 칸마다 ~거든요. 말끝은 존댓말로."
};
const LENS = {
  "보통 (6문장·약 200자)": "레퍼런스 평균 정도(6문장 안팎, 200자 안팎)",
  "짧게 (5문장·약 160자)": "레퍼런스 짧은 편(5문장, 160자 안팎)",
  "길게 (7~8문장·약 260자)": "레퍼런스 긴 편(7~8문장, 260자 안팎)"
};
const KINDS = ["대본","블로그","경험","주제","링크","기타"];
const STATUSES = ["초안","촬영완료","업로드완료"];
// 검사표에서만 쓰는 목록(프롬프트에 길게 늘어놓지 않는다)
const BANNED = ["핵심이에요","핵심은","핵심 포인트","결론부터","결론적으로","요약하면","정리하면","한마디로","다시 말해","즉,","주목할 점","이처럼","또한","이를 통해","이러한","따라서","그러므로","한편","매우","굉장히","정말로","놀랍게도","흥미롭게도","궁극적으로","전반적으로","할 필요가 있","것입니다","알아보겠","살펴보","다양한","효과적인","중요한 역할","나머진 자료","자료에서 공개","여러분"];

// 인기 릴스 대본 1~34편(요체) 원문 — 레퍼런스_대본원문/대본_문단구분_1-34.md 에서 뽑음. 빈 ( )는 지움
const REFS = [{"n": 1, "title": "1억 모으는 치트키 통장 TOP 3", "structure": "n가지형", "text": "후킹) 1억 모으고 싶다면 이 세 개는 무조건 만드세요!\n베네핏 - 주제 + n가지) 월급 2~300만 원 직장인, 2년 만에 1억 모으는 통장 TOP 3\n문제점 제시) 내 돈 어디에 두느냐에 따라서 속도가 5배 이상 차이 나서, 토스나 카카오뱅크 같이 이자 낮은 곳에 넣어두면 절대 안 되고,\n첫 번째) 월급은 이자 10배 쌓이는 통장으로,\n두 번째) 비상금은 하루만 도둑 8% 주는 통장으로,\n세 번째) 투자는 세금 400만 원 아끼는 통장으로 하면 되는데,\nCTA) 제가 자세한 내용 정리해놨으니까 저를 팔로우하고 댓글에 '3' 적어주세요."}, {"n": 2, "title": "11월 청년 혜택 TOP 7 (5000만 원 지원)", "structure": "혜택강조형", "text": "후킹) 2030은 이거 무조건 받아가세요!\n주제 - 베네핏) 2025년 11월 5000만 원 청년 혜택 TOP 7\n혜택나열) 올해 체크카드 한 번이라도 썼다면? 그럼 30만 원 돌려받을 수 있어요. 심지어 헬스장, 필라테스 비용 300만 원까지 지원받을 수 있고, 콘서트/뮤지컬/영화 예매권 15만 원, 월세 학자금 혜택까지,\nCTA) 꿀혜택 TOP 7 정리해놨으니까 저를 팔로우하고 댓글에 '7' 남기고 받아가세요."}, {"n": 3, "title": "S&P 500 똑똑하게 사는 꿀팁", "structure": "문제해결형", "text": "후킹) S&P 500 아무거나 사는 거 아니시죠?\n베네핏 - 주제) S&P 500 똑똑하게 사는 꿀팁\n공감유도 or 문제점 제시) S&P 500 검색하면 엄청 많이 나오는데 아무거나 사면 똑같이 투자해도 나만 수백만 원 손해 볼 수 있어요.\n문제해결) 수익률, 추적오차율, 배당 규모 이렇게 네 가지 지주 두고 구매하시면 되는데, 가장 똑똑하게 사는 방법부터 S&P 500 베스트 원까지 싹 다 정리해놨으니까\ncta(무료자료)) 저를 팔로우하고 댓글에 '500' 남겨주세요."}, {"n": 4, "title": "연말정산 374만 원 환급 꿀팁", "structure": "문제해결형", "text": "후킹) 저 연말정산 374만 원 받을 수 있대요!!\n베네핏 - 주제) 월급 한 번 더 생기는 연말정산 REAL 꿀팁\n공감유도 or 문제점 제시) 연말정산 세법은 매년 바뀌고, 공제 항목은 모가 뭔지도 또 너무 복잡하고, 일일이 환급받는 법 찾아보기 번거롭잖아요?\n문제해결) 근데 진짜 쉬운 방법 제가 가져왔습니다!! 카카오톡만 있다면 누구나! + 간편 인증, 연말정산 예상액을 1분 만에 확인 가능하고, 게다가 환급금 최대한으로 높일 수 있는 구체적인 방법까지 싹 다 알려줘서, 그냥 그대로 따라하기만 해도 한 달 월급 뚝-딱! 이에요. 저는 이렇게 따라하면 최대 374만 원까지 환급받을 수 있다네요?\ncta(무료자료)) 여러분도 돈 전부 챙겨가시라고 꿀팁 싹 다 정리해놨으니까, 댓글에 '연말정산' 달고 요 계산기 링크랑 정리본 바로 받아가세요."}, {"n": 5, "title": "환율 폭등 시기 당장 사야 할 자산 TOP 3", "structure": "문제해결형", "text": "후킹) 상위 1% 부자들은 전부 이걸로 갈아타고 있대요!\n베네핏 - 주제) 환율 폭등 시기 지금 당장 사야 할 자산 TOP 3\n공감유도 or 문제점 제시) 환율이 1400원을 넘어서 1500원을 가고 있는데 지금 가만히 있으면 아무것도 안 했는데 내 돈 30% 사라지는 충격적인 상황이 닥칠 수 있어요.\n문제해결) 하지만 준비만 잘하면 부자 될 기회가 오기도 한 거라 지금 당장 사야 할 자산 TOP 3 정리해놨으니까\ncta(무료자료)) 저를 팔로우하고 댓글에 '3' 적어주세요."}, {"n": 6, "title": "12월 마지막 정부 지원금 3000만 원 총정리", "structure": "혜택강조형", "text": "후킹) 12월 마지막 지원금 얼른 받아가세요!\n주제 - 베네핏) 3000만 원 받는 정부 지원금 총정리\n혜택나열) 12월 연말이라 정부에서 남은 예산을 싹 다 푼다고 해요!! 이번 겨울 따뜻하게 보내라고 주는 감기 조심하세요 여러분 ☃️ 난방비 지원금 70만 원부터 회사만 다니면 받는 480만 원 지원금 말고도 일곱 가지나 더 있는데,\n포모형성 or 혜택 강조) 예산 얼마 안 남은 것도 있으니 얼른 받아가야겠죠?\nCTA) 제가 싹 다 정리해놨으니까 저를 팔로우하고 댓글에 '12' 적어주세요."}, {"n": 7, "title": "4000만 원 만드는 정부지원통장", "structure": "문제해결형", "text": "후킹) 50만 원씩만 저축하면 나라에서 4000만 원까지?\n베네핏 - 주제) 이자 15% 통장, 50 → 4000만 원 빠르게 알려드릴게요\n공감유도 or 문제점 제시) 돈 나갈 곳은 많고 저축하기는 힘들잖아요?\n문제해결) 그래서 나라에서 50만 원씩만 저축하면 4000만 원을 만들어주는데, 나이랑 소득 제한 또 없어서 빨리 마감될 수 있어요.\ncta(무료자료)) 작용 요건이랑 방법 다 정리해놨으니까 댓글에 '1' 남겨주세요."}, {"n": 8, "title": "수백만 원 아끼는 증권사 갈아타기 꿀팁", "structure": "문제해결형", "text": "후킹) 증권사 아무거나 쓰지 마세요!\n베네핏 - 주제) 증권사 바꾸고 수백만 원 아끼는 꿀팁 바로 알려드릴게요\n공감유도 or 문제점 제시) 증권사 유명하다고 아무거나 쓰면 최소 수십에서 수백만 원은 더 나갈 수 있어서\n문제해결) 수수료 이벤트, 주식 계산 방식을 알아보고 선택해야 하는데, 요즘 증권사끼리 경쟁한다고 갈아타기만 해도 혜택을 주더라고요. 일곱 개 증권사 싹 다 비교해 놓고 베스트 1까지 상장해놨는데,\ncta(무료자료)) 팔로우하고 댓글에 '1' 적어주시면 바로 보내드릴게요."}, {"n": 9, "title": "2026년 더 늘어난 청년 혜택 총정리", "structure": "혜택강조형", "text": "후킹) 새해엔 2000만 원 무조건 받아가세요!\n주제 - 베네핏) 2026년 더 늘어난 청년혜택 총정리\n혜택나열) 올해에는 나라에서 더 많은 돈을 뿌릴 예정인데, 이자 17% 주는 목돈 통장부터 교통비 100% 돌려주는 교통카드, 취업하면 주는 축하금 700만 원에 상시 월세 지원 혜택까지 올해 5000만 원은 받을 수 있겠더라고요.\n포모형성 or 혜택 강조) 안 놓치고 신청하려면 미리 저장해둬야겠죠?\nCTA) 자세하게 정리해놨으니 댓글에 '1' 적어주세요."}, {"n": 10, "title": "이자 8% 주는 파킹통장 추천", "structure": "문제해결형", "text": "후킹) 아직도 카카오뱅크, 토스만 쓰시는 거 아니시죠?\n베네핏 - 주제) 이자 8% 주는 파킹통장으로 싹 갈아타세요\n공감유도 or 문제점 제시) 일반 통장에 돈 넣어두면 돈 거의 못 받는데,\n문제해결) 파킹통장은 하루만 넣어둬도 이자를 8%나 줘서 몇만 원씩 들어와요. 언제든지 꺼내 쓸 수도 있고 1억까지는 예금자보호되니까 안심하고 넣으셔도 되는데, 그럴 걸로 가장 높은 이자 받는 통장 제가 꼼꼼하게 정리해놨으니까\ncta(무료자료)) 저를 팔로우하고 댓글에 '파킹' 적어주세요."}, {"n": 11, "title": "2026년 가장 핫한 체크카드 TOP5", "structure": "혜택강조형", "text": "후킹) 체크카드는 제발 이거 쓰세요!\n주제 - 베네핏) 2026년 가장 핫한 체크카드 TOP5\n혜택나열) 요즘 체크카드는 신용카드보다 혜택이 훨씬 좋은데, OTT 50% 할인에, 온라인 쇼핑, 카페, 배달 30% 할인, 3만 5천 원 캐시백까지 되는데, 신용카드보다 소득공제도 2배 높아서 이거 안 쓰면 진짜 손해예요.\n포모형성 or 혜택 강조) 혜택이 너무 좋아서 언제 단종될지 모르니까,\nCTA) 댓글에 '체크' 적고 빨리 받아 가세요."}, {"n": 12, "title": "전월세 지원받는 자취 지원 TOP5", "structure": "혜택강조형", "text": "후킹) 아직도 내 돈으로 자취하는 거 아니시죠?\n주제 - 베네핏) 전월세 지원받는 자취 지원 TOP5\n혜택나열) 내년에도 전월세값이 더 오를 예정이라, 무조건 나라 돈으로 자취해야 되는데, 2026년엔 혜택이 더 늘어난대요. 보증금 1억 지원부터 집주인에게 못 받은 보증금까지 지원해 주고, 상시 월세 지원 혜택까지\nCTA) 올해 꼭 챙겨야 하는 혜택 자세하게 정리해 놨으니까, 댓글에 '자취' 적어 주세요."}, {"n": 13, "title": "S&P500 이제 그만 사야 돼요!", "structure": "n가지형", "text": "후킹) S&P500 이제 그만 사야 돼요!\n베네핏 - 주제 + n가지) S&P500보다 2배 수익난 ETF TOP5\n첫 번째) SPMO, S&P500 중에서도 최근 1년 수익률 상위 100개 종목만 남겨서, 주식 오를 때 주식을 사면 더 벌 수 있어요.\n두 번째) SMH, 엔비디아 등 AI/반도체 탑티어만 골라 담아서, 성장이 미쳤고.\n세 번째) GLDM, 금값 역대급으로 오른 수익 다 가져가는 거라 요즘 엄청 핫한데.\nCTA) 이외에도 S&P500보다 수익 내는 ETF들 싹 다 정리해 놨으니까, 댓글에 '5' 남겨 주세요. 팔로우 필수."}, {"n": 14, "title": "ISA통장 당장 멈추세요!", "structure": "혜택강조형", "text": "후킹) ISA통장 당장 멈추세요!\n주제 - 베네핏) 이재명 정부 역대급 통장 TOP5\n혜택나열) 올해 역대급 통장들이 쏟아지는데, 50만 원씩 5만 원 넣으면 2,200만 원 만들어 주는 이자 17% 적금부터, 해외 주식 세금 100% 면제되는 통장, 이자 3배 더 주는 청약통장 등 역대급 통장들만 싹 다 정리했는데,\n포모형성 or 혜택 강조) 올해 3월까지인 것도 있으니 빨리 받아 가야겠죠?\nCTA) 댓글에 '1' 적고 받아 가세요."}, {"n": 15, "title": "상위 1% 부자들은 적금 대신 이거!", "structure": "문제해결형", "text": "후킹) 상위 1% 부자들은 적금 말고 이거 한대요.\n베네핏 - 주제) 4개의 통장으로 월 300만 원 받는 꿀팁. 그 외에도 월세처럼 돈 따박따박 고치는 ETF 세팅법 빠르게 알려 드릴게요.\n공감유도 or 문제점 제시) 노후에도 매달 월금만큼 돈 들어오면 좋겠다고 생각하는데, 어디서부터 시작해야 될지 막막하잖아요.\n문제해결) 구조만 한 번 잘 세팅하면 되는데, 미래에셋 PB 1등 출신 105만 유튜버 박곰희 님이 매달 300만 원 받는 연금 노하우를 풀었어요. 투자 성향에 맞는 포트폴리오부터 종목명, 투자 비중까지 싹 다 알려줘서 이거 하면 연금 준비 끝이니 놓치면 안 되겠죠?\ncta(무료자료)) 월 300만 원 받는 연금 포트폴리오부터 링크까지 싹 다 정리해 놨으니까, 댓글에 '연금' 적어 주세요."}, {"n": 16, "title": "2026년 3,4월 파킹통장 추천", "structure": "문제해결형", "text": "후킹) 아직도 카카오뱅크랑 토스만 쓰시는 거 아니시죠?\n베네핏 - 주제) 이자 7% 주는 파킹통장으로 갈아타세요\n공감유도 or 문제점 제시) 일반 통장에 돈 넣어두면 돈 거의 못 받는데,\n문제해결) 파킹통장은 하루만 넣어둬도 이자를 7%나 줘서 몇만 원씩 들어와요. 언제든지 꺼내쓸 수도 있고, 1억까지는 예금자보호 되니까 안심하고 넣으셔도 되는데, 금액별 가장 높은 이자 받는 통장 제가 꼼꼼하게 정리해 놨으니까\ncta(무료자료)) 저를 팔로우하고 댓글에 '파킹' 적어 주세요."}, {"n": 17, "title": "5년 치 세금 돌려받으세요!", "structure": "문제해결형", "text": "후킹) 일하면서 낸 세금 당장 돌려받으세요! 두 달 뒤면 소멸된대요.\n베네핏 - 주제) 국세청에 있는 내 돈 5년 치 세금 돌려받는 꿀팁\n문제해결) 아무 조건 없이 놓쳤던 세금 5년 치까지 전부 찾아주고, 월세 낸 적 있다면 월세 공제까지 받을 수 있는데, 조에는 100% 무료라 300만 원이 이미 내 돈 찾아갔어요. 앱 설치도 필요 없이 2~3분이면 내 환급 바로 뜨는데,\n포모형성 or 혜택 강조) 5년 지나면 내 돈 국고로 사라지니까 이번에 꼭 받아 가야겠죠?\ncta(무료자료)) 댓글에 '환급' 적고 바로 받아 가세요. 3명 중 1명은 예상 환급액 있어요. 이미 300만 명이 받아 감."}, {"n": 18, "title": "2026년 주식시장 대박 기회!", "structure": "문제해결형", "text": "후킹) 주식시장에 곧 큰 거 하나 터져요!\n베네핏 - 주제) SK하이닉스와 토스가 미국 시장에 상장한다는 거 다들 알고 계시죠?\n공감유도 or 문제점 제시) 한국에 있어서 억눌렸던 주가가 미국 돈을 빨아들이면서 미친듯이 재평가된다는 건데,\n문제해결) 미국 상장 터지기 전에 알아둬야 하는 매수 타이밍이랑 전략 싹 다 정리해 뒀어요.\ncta(무료자료)) 댓글에 '1'이라고 적고 바로 받아 가세요."}, {"n": 19, "title": "2026년 1월 월배당 ETF 추천", "structure": "문제해결형", "text": "후킹) 예적금 대신 이걸로 월 100만 원 받으세요. 연 1,200만 원 꽁돈!\n베네핏 - 주제) 월급처럼 따박따박 돈 들어오는 ETF 베스트 5. 저는 이 방법으로 연봉만큼 더 모았어요.\n공감유도 or 문제점 제시) 요즘 예적금 이자 2%밖에 안 되는데,\n문제해결) ETF 세팅만 잘해놨더니 매달 100만 원씩 월급처럼 들어오더라고요. 요즘 가장 핫한 ETF 다섯 개부터 수익 두 배 나는 꿀팁 쉽게 정리해 놨으니까,\ncta(무료자료)) 댓글에 '배당' 적어 주시면 정리본 바로 보내드릴게요."}, {"n": 20, "title": "2026년 명절 지원금 총정리", "structure": "혜택강조형", "text": "후킹) 이번 설에 60만 원 지원금 꼭 받아 가세요!\n주제 - 베네핏) 60만 원 받아 가는 설날 지원금 총정리\n혜택나열) 누구나 받는 50만 원 지원금부터 농축산물 40% 할인, 효도지원금까지 설 지원금이 정말 넘쳐나는데,\n포모형성 or 혜택 강조) 선착순인 것도 있어서 빨리 정리해 왔으니까,\nCTA) 댓글에 '설날' 적고 받아 가세요."}, {"n": 21, "title": "직장인이 무조건 알아야 할 청약통장 꿀팁", "structure": "문제해결형", "text": "후킹) 청약 통장 2만 원씩 절대 넣지 마세요!\n공감유도 or 문제점 제시) 아직도 2만 원씩 넣고 계신 거 아니죠? 청약 통장 2만 원씩 넣으면 오히려 손해 보고, 무작정 많이 넣는다고 당첨되는 것도 아니더라고요.\n문제해결) 지역별 금액이 정해져 있고, 그 금액 넘으면 적금 따로 넣는 게 훨씬 이득인데, 이거 모르고 자동이체만 걸어두면 진짜 손해라서 싹 다 정리해 놨으니까\ncta(무료자료)) 댓글에 청약 적고 빨리 받아 가세요."}, {"n": 22, "title": "ISA 금지 종목 TOP3", "structure": "문제해결형", "text": "후킹) ISA에 절대 사지 마세요!\n베네핏 - 주제) ISA 금지 종목 TOP3\n공감유도 or 문제점 제시) 다들 세금 아끼려고 ISA 계좌 만들잖아요. 근데 어떤 건 ISA에서 안 사는 게 낫고, 어떤 건 ISA에 넣어야 혜택 왕창 받는데, 이거 모르고 담았다가 혜택 날리시는 분들 진짜 많아서\n문제해결) 싹 다 정리해 뒀으니까 지금 당장 확인해 봐야겠죠?!\ncta(무료자료)) 댓글에 3 적고 바로 받아 가세요."}, {"n": 23, "title": "2030 청년 60만 원 지원금 총정리", "structure": "문제해결형", "text": "후킹) 연봉 5,000만 원 이하면 무조건 신청하세요!\n베네핏 - 주제) 2030 청년 60만 원 지원금 총정리\n문제해결) 이재명 정부에서 3차 민생 지원금으로 최대 60만 원까지 지급하는데, 사는 지역 소득 구간마다 다 달라서 전부 정리해 뒀어요.\n포모형성 or 혜택 강조) 신청 기간 지나면 못 받으니까\ncta(무료자료)) 댓글에 5 적고 받아 가세요."}, {"n": 24, "title": "연 19% 적금이 나왔어요!", "structure": "혜택강조형", "text": "후킹) 6월 22일 연 19% 적금이 나와요.\n주제 - 베네핏) 정부가 12%를 얹어주고, 금리도 최대 8%, 비과세까지 합치면 19% 효과래요.\n혜택나열) 14개 시중은행 싹 다 분석해서 가장 이자 많이 주는 은행부터 청년도약계좌 있으신 분들은 갈아타는 게 유리한지 시뮬레이션까지 만들어 왔는데,\nCTA) 댓글에 미래 남겨주시면 바로 보내드릴게요 :)"}, {"n": 25, "title": "월세 환급금 170만 원 총정리", "structure": "문제해결형", "text": "후킹) 월세 사시는 분들 170만 원 받아 가세요.\n베네핏 - 주제) 월세 환급금 170만 원 총정리\n공감유도 or 문제점 제시) 이거 신청만 하면 받는 건데, 모르는 월세 다 내시는 분들이 너무 많으시더라고요.\n문제해결) 집 주인 동의 필요 없어요. 신청해도 집 주인에게 알람 안 갑니다. 5년 전 월세까지 싹 다 돌려받을 수 있는데, 1년만 늦어져도 사라지니까 얼른 받아 가야겠죠?\ncta(무료자료)) 신청 방법이랑 준비물 전부 정리해 뒀으니까 댓글에 5 남겨주세요."}, {"n": 26, "title": "삼성전자 하이닉스 놓쳤다면 이거 사세요! (2단)", "structure": "문제해결형", "text": "후킹) 삼전 하이닉스 놓쳤다면 이거 사세요!\n베네핏 - 주제) 반도체 ETF 추천\n공감유도 or 문제점 제시) 삼전 하이닉스 1년 동안 400% 올랐는데, 지금 너무 오를 거 같고 그렇다고 안 사기에 애매하고 너무 비싸잖아요.\n문제해결) 그럴 테니 이 ETF만 딱 골라 사면 되는데, 주린이도 돈 벌 수 있도록 싹 다 정리해 냈으니까\ncta(무료자료)) 삼전 적고 받아 가세요."}, {"n": 27, "title": "직장인은 5월에, 330만 원 받아 가세요!", "structure": "문제해결형", "text": "후킹) 직장 다니시는 분들 5월에 나라에서 330만 원 뿌린대요.\n베네핏 - 주제) 근로장려금 330만 원 총정리\n공감유도 or 문제점 제시) 나라에서 직장인 힘내라고 주는 건데, 신청 안 해서 못 받으시는 분들이 너무 많으시더라고요.\n문제해결) 받을 수 있는 조건이 딱 세 가지인데, 이 중에 두 가지만 해당돼도 최대 330만 원 받을 수 있어요. 근데 이거 5월 한 대가만 신청 가능해서 놓치면 끝이니까 빨리 받아 가야겠죠?\ncta(무료자료)) 세 가지 조건이랑 신청 방법까지 싹 다 정리해 뒀으니까 댓글에 3 남겨주시면 바로 보내드릴게요."}, {"n": 28, "title": "30대인데 모은 돈이 없다면 이렇게 따라하세요!", "structure": "n가지형", "text": "후킹) 30대인데 모른 돈이 없다면 이렇게 따라하세요!\n베네핏 - 주제 + n가지) 월급 2배 빨리 모으는 재테크 치트키\n첫 번째) 1단계 월급을 2배 빨리 모으는 시스템 만들고,\n두 번째) 2단계 예적금 4배 이상 굴리는 나만의 포트폴리오,\n세 번째) 3단계 추가 돈 벌기 이 3스텝 같이 밟아 가야 되는데,\n공감유도) 저는 20대 때 마이너스 통장으로 시작했고 돈 못 모았던 사람이라 시행착오 겪었던 거 제가 전부 정리해 뒀거든요.\nCTA) 이것은 곧 삭제될 예정이니까 댓글에 30다고 꼭 바로 확인해 보세요!"}, {"n": 29, "title": "주식 파란불이라고 슬퍼하지 마세요!", "structure": "문제해결형", "text": "후킹) 주식 파란불이라고 슬퍼하지 마세요! 그거 아직 내 돈 아니에요.\n공감유도 or 문제점 제시) 저도 예전엔 이거 몰라서 마이너스 75%까지 갔거든요. 어 그때 알았어요. 문제는 종목이 아니라 관리였다는 걸!\n문제해결) 코스피 폭락한 이유부터 대응 방안까지 전부 정리해 놨으니까\ncta(무료자료)) 댓글에 아무 말 달고 받아 가세요."}, {"n": 30, "title": "7월 청년혜택 3000만원 총정리", "structure": "혜택강조형", "text": "후킹) 7월에 2030은 3000만 원 받아 가세요.\n주제 - 베네핏) 3000만 원 받는 청년지원금 총정리\n혜택나열) 7월에도 나라에서 돈을 퍼주고 있는데, 120만 원 복지지원금, 70만 원 냉방비 지원, 150만 원 인재지원금, 여름 휴가비 반값 지원까지 싹 다 정리했거든요.\n포모형성 or 혜택 강조) 7월에 마감되는 것도 있으니까\nCTA) 7 적고 바로 받아 가세요."}, {"n": 31, "title": "반려동물 키우는 분들 100만원 받아가세요", "structure": "문제해결형", "text": "후킹) 반려동물 키우는 분들 나라에서 돈 준대요!\n베네핏 - 주제) 100만 원 주는 반려동물 지원금 바로 알려드릴게요\n공감유도 or 문제점 제시) 강아지, 고양이 키우면 병원비에 미용비에 몇만 원은 기본으로 나가잖아요.\n문제해결) 우리 정부에서 주는 반려동물 복지가 엄청 늘었는데, 지역별로 신청 시기가 달라서 잘 체크해야 되거든요. 제가 자세하게 싹 다 정리해 놨으니까\ncta(무료자료)) 댓글에 '반려동물' 적고 받아 가세요."}, {"n": 32, "title": "부자들이 쓸어담고 있는 ETF", "structure": "n가지형", "text": "후킹) 미국이랑 한국 주식 다 폭락했어요! 부자는 이 ETF 조용히 쓸어담고 있다는데,\n베네핏 - 주제 + n가지) 당장 사야 하는 AI 반도체 ETF 바로 알려드릴게요\n공감유도 or 문제점 제시) 지난번 트럼프 관세 때문에 주가 빠졌을 때 주줍한 사람들도 결국 다 부자 됐잖아요. 주가 조정 받는 지금이 딱 부자 될 기회인데, 아무 AI 반도체나 사면 돈 다 묶이거든요.\n첫 번째) 삼성전란 하이닉스가 50% 이상 담긴 걸로 골라야 반등할 때 남들보다 더욱 크게 수익 먹고,\n두 번째) 소재 부품 장비까지 깔아둔 걸로 골라야 떨어질 때 덜 떨어지고,\n세 번째) 뜨는 종목 알아서 리밸런싱해 줘야 지금 트렌드 안 놓치거든요.\n포모형성) 관련해서 제가 싹 다 정리해 놨는데 반등 시작하면 늦으니까 무조건 챙겨야겠죠?!\nCTA) 댓글에 '반도체' 적고 빨리 받아 가세요."}, {"n": 33, "title": "월 100만원 만드는 ETF 베스트 3", "structure": "문제해결형", "text": "후킹) 예적금 대신 이걸로 월 100만 원 받으세요.\n베네핏 - 주제) 월급처럼 따박따박 돈 들어오는 ETF 베스트 3. 저도 이 방법으로 연봉만큼 더 모았어요.\n공감유도 or 문제점 제시) 요즘 예적금 이자 2%밖에 안 되는데,\n문제해결) ETF 세팅만 잘 해놨더니 매달 월급처럼 돈이 따박따박 들어오더라고요. 성장형 고배당형 커버드콜형 이 세 가지만 알면 끝인데, 배당주 세팅법 쉽게 싹 다 정리해 놨으니까\ncta(무료자료)) 댓글에 '배당' 적어 주시면 정리본 바로 보내드릴게요."}, {"n": 34, "title": "딱 3년 만에 1억 만드는 통장 TOP 3", "structure": "n가지형", "text": "후킹) 월급 250만 원인데 3년 안에 1억 모으려면 어떻게 해야 하나요?\n베네핏 - 주제 + n가지) 내 돈 어디에 두느냐에 따라 속도가 3배 이상 차이 나거든요. 먼저 이 통장 3개 있는지 점검해 보세요.\n첫 번째) 일반 통장보다 이자 10배 더 주는 월급 통장에 돈 넣어놨나?!\n두 번째) 목돈은 하루만 넣어도 이자 70배 더 주는 통장에,\n세 번째) 투자는 세금 400만 원 아끼는 통장에 넣어놨다?\nCTA) 3개 다 하셨나요? 제가 쉽게 할 수 있도록 전부 정리해 놨거든요. 댓글 달아주시면 자세하게 정리해서 보내드릴게요."}];


function refsText(struct){
  // 고른 구조의 대본을 앞에, 나머지는 뒤에. 34편 전부 넣는다(9천 자 남짓).
  const pick = struct && struct !== "자동" ? REFS.filter(r => r.structure === struct).concat(REFS.filter(r => r.structure !== struct)) : REFS;
  return pick.map(r => `## ${r.n}. ${r.title} (${r.structure})\n${r.text}`).join("\n\n");
}

const RULES = `너는 인스타 릴스 재테크 채널 "신혼테크"의 대본 작가야. 화자는 여성, 보는 사람은 재테크를 막 시작한 2030(신혼·사회초년생)이야.

맨 아래 [레퍼런스 대본]은 실제로 조회수가 크게 나온 릴스 대본 원문이야. 먼저 이 대본들을 소리 내어 읽듯이 읽고 리듬을 익혀:
- 한 호흡이 짧고, 숫자가 앞쪽에 오고, 후킹에서 던진 숫자를 바로 다음 줄에서 다른 표기로 다시 말한다(3천만 원 → 3000만 원 TOP5).
- "이거"로 숨겼으면 바로 다음 줄에서 정체를 밝힌다.
- 문제해결·포모 줄은 "~는데," "~니까"로 끝나서 CTA와 한 숨에 이어진다. "정리해 놨으니까 팔로우하고 댓글에 '○○' 남겨 주세요."
- 부사 뼈대는 싹 다·무조건·바로·딱·심지어. 접속사(근데·그래서·또한)는 거의 안 쓴다.
- 설명하지 않고 시킨다. 평서문 나열("~입니다", "~예요. ~예요. ~예요.")이 아니라 ~세요·~거든요·~잖아요·~대요가 섞인다.
문장은 베끼지 말고 이 결로 새로 써.

[우선순위 — 부딪치면 위가 이긴다]
1. 사용자가 쓴 대강 대본. 그 안의 사실·숫자·경험·하고 싶은 말·말맛 있는 표현은 사용자가 고른 거야. 빼지 말고 살린다. 이미 좋은 문장은 그대로 둔다.
2. 레퍼런스 대본의 리듬과 슬롯 순서.
3. 아래 참고 사항. 범위 숫자는 참고일 뿐이라 사용자 내용을 잘라 내면서까지 맞추지 않는다.

[슬롯 순서 — 구조 셋 중 하나]
- 문제해결형(상품·제도 하나를 깊게): 후킹 → 베네핏 - 주제 → 공감유도 or 문제점 제시(없어도 됨) → 문제해결 → 포모형성 or 혜택 강조(없어도 됨) → CTA
- 혜택강조형(혜택 여러 개 묶음): 후킹 → 주제 - 베네핏 → 혜택나열("A부터 B에 C까지" 한 호흡, 끝에 "심지어 ○○는 더 받아요") → 포모형성 or 혜택 강조 → CTA
- n가지형(딱 3개): 후킹 → 베네핏 - 주제 + n가지 → 문제점 제시(없어도 됨) → 첫 번째 → 두 번째 → 세 번째 → CTA

[후킹 — 하나 고르기]
${HOOKS.map(h => `- ${h[0]}: ${h[1]} (예: ${h[2]})`).join("\n")}
후킹은 공백 빼고 16~20자 정도, 대상(2030·직장인·월세 사시는 분)을 부르면 좋다.

[CTA]
댓글 키워드는 주제어 한 단어가 기본이야('적금', '파킹'). 숫자 키워드는 후킹 숫자와 같을 때만 쓰고, 뜻 없는 '1'은 쓰지 않는다.

[사실]
- 숫자·날짜·조건은 사용자가 대강 대본이나 "확인한 숫자"에 적은 것은 자유롭게 쓴다. 그 밖의 새 숫자가 필요하면 지어내지 말고 [확인: 무엇]으로 자리만 둔다.
- 경험은 사용자 글이나 붙인 메모에 있는 것만 쓰고, 날짜 대신 "전에"라고 말한다. 없는 경험·수익·가족 대화는 만들지 않는다.
- 주식 주제는 종목을 사라고 권하지 않는다.
- 초보 눈높이: 시장 상식을 깔고 들어가지 않는다. 공감 줄은 월급·대출이자·물가처럼 생활에서 아는 것으로. 용어는 처음 나올 때 쉬운 말로 푼다.
- 글 하나에 이야기 하나. 곁가지·낯선 이름 나열은 뺀다.
- 말투는 존댓말 고정(반말 금지). "여러분", "결론적으로", "또한", "~것입니다"는 쓰지 않는다.

[화면요소 — 문장마다 ( ) 안에 하나]
후킹은 정부 로고 붙은 입금 알림 카드나 실제 시세·속보 캡처, 공감은 큰 감정 이모지 하나, 해결은 공식 표·기사 캡처에 빨간 박스, "정리해 놨으니까" 줄은 정리 문서 흐리게, CTA는 ⌨️ 키보드 + 주제 이모지. 사람 사진은 쓰지 않는다.

[표지 2줄 · 제목]
- 표지 상단 2줄(각 4~10자): 물건·행동 하나를 지목하는 말, N가지·TOP, ~이유, ~근황, 날짜 + 구체적으로 잃는 것("10월 17일 단종 확정!!")이 잘 된다. "확인하세요·신청하세요" 같은 안내 명령, '손해'라는 낱말, "~받는 방법"은 약하다.
- 제목: 뉴스 헤드라인처럼, 메인 키워드를 넣고 명령형(~하세요/받아가세요/~된다!)으로. 나이·소득 같은 조건은 제목에서 숨긴다.`;

const SLOT_FORMAT = `후킹) 문장 ( 화면요소 )
베네핏 - 주제) 문장 ( 화면요소 )
문제해결) 문장, ( 화면요소 ) 다음 문장 ( 화면요소 )
CTA) 문장 ( 화면요소 )`;


function versionFormat(label){
  return `=== ${label} ===
제목) 릴스 제목
표지) 1줄 / 2줄
구조) 문제해결형 | 혜택강조형 | n가지형
후킹유형) 후킹 유형 이름
${SLOT_FORMAT}
바꾼 점) 무엇을 왜 바꿨는지 한두 줄`;
}
const TAIL_FORMAT = `=== 공통 ===
캡션) 인스타 캡션 3~5줄(존댓말, 첫 줄은 후킹 한 줄)
해시태그) #태그 #태그 #태그 #태그 #태그
쓴 메모) 실제로 반영한 메모 id (없으면 비움)
확인할 것) 올리기 전에 공식 원문으로 확인할 숫자·사실 / 로 구분 (없으면 비움)`;

function orderLines(inp, ideas){
  const s = [];
  s.push("[이번 주문]");
  s.push(`- 주제·키워드: ${inp.topic || "(대강 대본에서 뽑아)"}`);
  s.push(`- 구조: ${inp.struct === "자동" ? "자동 — 내용에 맞게 골라" : inp.struct}`);
  s.push(`- 후킹 유형: ${inp.hook === "자동" ? "자동 — 내용에 맞게 골라" : inp.hook}`);
  s.push(`- 말투: ${inp.tone} — ${TONES[inp.tone] || ""}`);
  s.push(`- 길이: ${LENS[inp.len] || inp.len}`);
  if(inp.cta) s.push(`- 댓글 키워드: '${inp.cta}'`);
  s.push(`\n[사용자가 쓴 대강 대본 — 1순위. 사실·숫자·경험·좋은 표현은 살린다]\n${inp.rough || "(없음)"}`);
  s.push(`\n[사용자가 확인한 숫자·날짜]\n${inp.facts || "(따로 없음)"}`);
  if(ideas.length){
    s.push("\n[붙인 아이디어 메모 — 관련 있을 때만 관점·경험으로. 억지로 넣지 않는다]");
    ideas.forEach(i => s.push(`- id ${i.id} (${i.kind || "메모"}): ${String(i.text).slice(0, 600)}`));
  }
  return s;
}

function buildPrompt(inp, ideas){
  const hasRough = !!(inp.rough && inp.rough.trim());
  const s = [RULES, ""].concat(orderLines(inp, ideas));
  s.push("\n[할 일]");
  if(hasRough){
    s.push(`대본을 두 버전으로 써.
- 버전 A "내 대본 살림": 사용자 대강 대본을 뼈대로 두고 최소한만 고친다. 사용자 문장과 순서를 되도록 그대로 두고, 슬롯 이름을 붙이고, 후킹·CTA·호흡만 레퍼런스처럼 다듬는다. 사용자 표현의 70% 이상이 남아 있어야 한다.
- 버전 B "레퍼런스식": 같은 사실과 같은 이야기로, 레퍼런스 대본처럼 처음부터 다시 짠다. 사용자 숫자·경험은 그대로 쓴다.
두 버전 모두 다 쓴 뒤, 사용자 대강 대본에 있던 사실·숫자·경험 중 빠진 게 없는지 한 번 대조해서 빠진 게 있으면 넣어.`);
  } else {
    s.push(`대본을 두 버전으로 써. 두 버전은 후킹 유형이 달라야 한다(구조는 같아도 된다).
- 버전 A: 이 주제에 가장 잘 맞는 후킹.
- 버전 B: A와 다른 심리를 건드리는 후킹.`);
  }
  s.push(`
[답 형식 — 아래 글 형식 그대로. JSON·코드펜스·설명 없이]
${versionFormat(hasRough ? "버전 A: 내 대본 살림" : "버전 A")}

${versionFormat(hasRough ? "버전 B: 레퍼런스식" : "버전 B")}

${TAIL_FORMAT}

슬롯 줄 하나에 문장이 여럿이면 문장마다 뒤에 ( 화면요소 )를 붙여. 슬롯 이름은 위 구조의 이름을 그대로 써.

[레퍼런스 대본]
${refsText(inp.struct)}`);
  return s.join("\n");
}

function buildRevisePrompt(sc, instruction){
  return `${RULES}

[할 일] 아래 대본을 사용자 요청대로 고쳐. 요청하지 않은 부분은 그대로 둔다. 사용자 숫자 밖의 새 숫자는 [확인: 무엇]으로.
사용자 요청: ${instruction}

[사용자가 확인한 숫자·날짜]
${(sc.input && sc.input.facts) || "(따로 없음)"}
[처음에 쓴 대강 대본]
${(sc.input && sc.input.rough) || "(없음)"}

[지금 대본]
${scriptText(sc)}

[답 형식 — 아래 글 형식 그대로. JSON·코드펜스·설명 없이]
${versionFormat("고친 버전")}

${TAIL_FORMAT}

[레퍼런스 대본]
${refsText(sc.structure)}`;
}

// ── 글 형식 답 읽기 ─────────────────────────────────────
const META_KEYS = { "제목": "title", "표지": "cover", "구조": "structure", "후킹유형": "hookType", "후킹 유형": "hookType", "바꾼 점": "why", "바꾼점": "why",
  "캡션": "caption", "해시태그": "hashtags", "쓴 메모": "usedIdeaIds", "확인할 것": "needCheck" };
function splitLines(text){
  // "문장 ( 화면 ) 문장 ( 화면 )" → [{text, visual}]
  const out = []; const re = /([^()]*?)\s*\(\s*([^()]*?)\s*\)/g; let m, last = 0;
  while((m = re.exec(text))){
    const t = m[1].trim();
    if(t) out.push({ text: t, visual: m[2].trim() });
    else if(out.length && m[2].trim()) out[out.length - 1].visual = (out[out.length - 1].visual ? out[out.length - 1].visual + " · " : "") + m[2].trim();
    last = re.lastIndex;
  }
  const rest = text.slice(last).trim();
  if(rest) out.push({ text: rest, visual: "" });
  return out;
}
function parseScriptText(raw, inp){
  const text = String(raw || "").replace(/```[a-z]*\n?/g, "").replace(/\r/g, "");
  const parts = text.split(/^===\s*(.+?)\s*===\s*$/m);
  const sections = [];
  if(parts.length === 1) sections.push({ label: "대본", body: parts[0] });
  for(let i = 1; i < parts.length; i += 2) sections.push({ label: parts[i].trim(), body: parts[i + 1] || "" });
  let common = {};
  const versions = [];
  for(const sec of sections){
    const meta = {}; const slots = []; let lastKey = null;
    for(const line of sec.body.split("\n")){
      const l = line.trim().replace(/^cta\s*\([^)]*\)\)/i, "CTA)"); if(!l) continue;
      const m = l.match(/^([^()]{1,30}?)\)\s*(.*)$/);
      if(m){
        const key = m[1].replace(/^대본\s*\+\s*영상기획\s*/, "").trim();
        if(META_KEYS[key]){ meta[META_KEYS[key]] = m[2].trim(); lastKey = META_KEYS[key]; continue; }
        slots.push({ slot: key.replace(/^cta\s*\(.*$/i, "CTA"), raw: m[2] }); lastKey = "slot"; continue;
      }
      if(lastKey === "slot" && slots.length) slots[slots.length - 1].raw += " " + l;
      else if(lastKey) meta[lastKey] = (meta[lastKey] ? meta[lastKey] + "\n" : "") + l;
    }
    if(/공통/.test(sec.label) && !slots.length){ common = meta; continue; }
    if(!slots.length) continue;
    versions.push({ label: sec.label.replace(/^버전\s*/, ""), meta, slots: slots.map(s => ({ slot: s.slot, lines: splitLines(s.raw) })).filter(s => s.lines.length) });
  }
  const split = (v, re) => String(v || "").split(re).map(x => x.trim()).filter(x => x && !/^\(?없음\)?$/.test(x));
  return versions.map(v => {
    const m = Object.assign({}, common, v.meta);
    return {
      label: v.label,
      title: m.title || inp.topic || "제목 없음",
      cover: split(m.cover, /\s*\/\s*/).slice(0, 2),
      structure: (m.structure || "").replace(/\s*\|.*$/, ""), hookType: m.hookType || "", why: m.why || "",
      slots: v.slots,
      ctaKeyword: inp.cta || ((v.slots.find(s => /cta/i.test(s.slot)) || { lines: [] }).lines.map(l => l.text).join(" ").match(/'([^']{1,12})'/) || [])[1] || "",
      caption: m.caption || "", hashtags: split(m.hashtags, /\s+/).filter(t => t.startsWith("#")),
      needCheck: split(m.needCheck, /\s*\/\s*|\n/), usedIdeaIds: split(m.usedIdeaIds, /[\s,]+/),
      topic: inp.topic || "", input: inp
    };
  });
}


function normalize(r, inp){
  r = (r && typeof r === "object" && !Array.isArray(r)) ? r : {};
  const slots = (Array.isArray(r.slots) ? r.slots : []).map(s => {
    let lines = Array.isArray(s.lines) ? s.lines : (s.text ? [{ text: s.text, visual: s.visual || "" }] : []);
    lines = lines.map(l => typeof l === "string" ? { text: l, visual: "" } : { text: String(l.text || ""), visual: String(l.visual || "") }).filter(l => l.text.trim());
    return { slot: String(s.slot || s.name || "슬롯"), lines };
  }).filter(s => s.lines.length);
  return {
    title: String(r.title || inp.topic || "제목 없음"),
    cover: Array.isArray(r.cover) ? r.cover.slice(0, 2).map(String) : [String(r.cover || "")],
    structure: String(r.structure || ""),
    hookType: String(r.hookType || ""),
    why: String(r.why || ""),
    slots,
    ctaKeyword: String(r.ctaKeyword || inp.cta || ""),
    caption: String(r.caption || ""),
    hashtags: Array.isArray(r.hashtags) ? r.hashtags.map(String).slice(0, 8) : [],
    needCheck: Array.isArray(r.needCheck) ? r.needCheck.map(String) : [],
    usedIdeaIds: Array.isArray(r.usedIdeaIds) ? r.usedIdeaIds.map(String) : [],
    topic: inp.topic || "", input: inp
  };
}
function allSentences(sc){
  const out = [];
  sc.slots.forEach(s => s.lines.forEach(l => {
    (l.text.match(/[^.!?]+[.!?]*/g) || []).forEach(x => { if(x.trim()) out.push(x.trim()); });
  }));
  return out;
}
function analyze(sc){
  const said = sc.slots.map(s => s.lines.map(l => l.text).join(" ")).join(" ");
  const chars = said.length;
  const sentences = allSentences(sc);
  const sentCount = sentences.length;
  const nums = (said.match(/\d[\d,.~]*/g) || []).length;
  const hook = sc.slots[0] ? sc.slots[0].lines.map(l => l.text).join(" ") : "";
  const hookLen = hook.replace(/\s/g, "").length;
  const hookNum = /\d/.test(hook);
  const banned = BANNED.filter(w => said.includes(w));
  const banmal = sentences.filter(x => {
    const t = x.replace(/[.!?~\s]+$/, "");
    if(/(요|죠|니다|세요|까)$/.test(t)) return false;
    return /(거든|해줘|줄게|알아|잖아|더라고|이야|거야|했어|있어|없어|된대|한대|받기|챙기기|남기기|적기|돼|해)$/.test(t);
  });
  const checks = (sc.needCheck || []).length + (said.match(/\[확인/g) || []).length;
  const rng = (v, a, b, c, d) => v >= a && v <= b ? "ok" : (v >= c && v <= d ? "warn" : "bad");
  return [
    { k: `글자 ${chars}자`, c: rng(chars, 150, 280, 120, 320), tip: "인기 대본 150~280자" },
    { k: `문장 ${sentCount}개`, c: rng(sentCount, 5, 8, 4, 10), tip: "중앙 6문장" },
    { k: `숫자 ${nums}개`, c: rng(nums, 3, 7, 1, 9), tip: "중앙 5개" },
    { k: `후킹 ${hookLen}자`, c: rng(hookLen, 12, 24, 9, 30), tip: "공백 빼고 16~20자" },
    { k: hookNum ? "후킹에 숫자 ✔" : "후킹에 숫자 없음", c: hookNum ? "ok" : "warn", tip: "68%가 첫 문장에 숫자" },
    { k: banned.length ? `금지어 ${banned.join("·")}` : "금지어 0", c: banned.length ? "bad" : "ok" },
    { k: banmal.length ? `반말 ${banmal.length}곳` : "요체 ✔", c: banmal.length ? "bad" : "ok", tip: banmal.join(" / ") },
    { k: checks ? `확인할 것 ${checks}` : "확인할 것 0", c: checks ? "warn" : "ok" }
  ];
}
function scriptText(sc, mode){
  if(mode === "say") return sc.slots.map(s => s.lines.map(l => l.text).join("\n")).join("\n");
  if(mode === "caption") return [sc.caption, "", (sc.hashtags || []).join(" ")].join("\n").trim();
  const head = [`제목) ${sc.title}`, `표지) ${(sc.cover || []).join(" / ")}`, `대본구조: ${sc.structure} · 후킹: ${sc.hookType}`, ""];
  const body = sc.slots.map(s => `${s.slot}) ` + s.lines.map(l => `${l.text} ( ${l.visual || ""} )`).join(" "));
  const tail = sc.needCheck && sc.needCheck.length ? ["", "확인할 것) " + sc.needCheck.join(" / ")] : [];
  return head.concat(body, tail).join("\n");
}


// ── 녹화한 대본 → 블로그 초안 + 노션 전자책 (설치 앱 전용, 2026-10-07) ─────────
// 규칙 문서는 누를 때마다 저장소에서 최신본을 읽는다(지침을 고치면 앱도 바로 따라간다).
// 결과는 저장소 네이버블로그/자동초안/<오늘>/ 에 넣고 .상단고정 을 붙인다 → 맥북 BlogSync가 받아 확장 목록 맨 위에 뜬다.
const EXPAND_DOCS = [
  ["원고 생성 필독", "네이버블로그/원고_생성_필독.md"],
  ["정체성·문체 통합가이드 v6", "네이버블로그/신혼테크_정체성_문체_홈판_통합가이드_v6.md"],
  ["경험사실 레지스트리(여기 있는 경험만 쓸 수 있다)", "네이버블로그/경험사실_레지스트리_v1.md"],
  ["블로그 루틴 지침 4·4b·4c절", "네이버블로그/블로그_루틴_지침.md", ["## 4. ", "## 4b. ", "## 4c. "]],
  ["노션 무료자료(전자책) 양식", "캐러셀/무료자료_양식.md"]
];
function pickSections(md, heads){
  const parts = md.split(/^(?=## )/m);
  return parts.filter(p => heads.some(h => p.startsWith(h))).join("\n");
}
function buildExpandPrompt(sc, docs){
  const inp = sc.input || {};
  const kw = sc.ctaKeyword || "";
  return `너는 재테크 채널 "신혼테크"의 네이버 블로그 작가이자 무료자료(노션 전자책) 편집자야.
사용자가 아래 릴스 대본을 녹화했어. 이 대본을 바탕으로 블로그 글 하나와 노션 전자책 하나를 만든다.

[녹화한 릴스 대본]
${scriptText(sc)}

[대본을 만들 때 사용자가 준 재료]
대강 대본: ${inp.rough || "(없음)"}
확인한 숫자·날짜: ${inp.facts || "(따로 없음)"}

${docs.map(d => `[규칙 문서: ${d.name}]\n${d.text}`).join("\n\n")}

[할 일]
1. 블로그 글 — 릴스를 보고 검색해서 들어온 사람이 더 자세히 알 수 있는 글. 위 규칙 문서를 그대로 따른다:
   공백 제외 1,500~2,000자 / 맨 위 공부방 안내 블록(주식·코인 공부 이야기만, 문구는 새로) + https://litt.ly/newlywed_tech 줄과 그 뒤 빈 줄 /
   소제목은 "> " 인용구 줄 / 숫자 목록은 "1.문장"(점 뒤 띄어쓰기 없음) / 팔로우·댓글 CTA 없음 / 하단 "출처:"·"※" 문단 없음 /
   정부·지자체 지원금 글이면 맨 아래 신청 링크 / 마지막은 독자가 자기 상황을 돌아보는 질문 / 제목은 뉴스 헤드라인식, 이모지 없이.
   대본과 같은 이야기지만 문장은 새로 쓴다(대본 문장 복사 금지).
2. 노션 전자책 — 대본 CTA에서 댓글${kw ? ` '${kw}'` : ""}를 남긴 사람에게 보내 주는 자료. 양식 문서의 순서와 고정 문구를 그대로 따른다.
   맨 앞에는 블로그와 다른 문구의 공부방 안내 블록(링크 포함)을 둔다. 블로그 글과 문장이 겹치지 않게, 표·체크리스트처럼 바로 써먹는 형태로.
사실: 대본과 사용자 재료에 있는 숫자·날짜만 쓴다. 꼭 필요한데 없는 숫자는 지어내지 말고 [확인: 무엇]으로 둔다. 경험은 레지스트리와 사용자 재료에 있는 것만.

[답 형식 — 아래 그대로. 코드펜스·설명 없이]
=== 블로그 ===
블로그 제목 한 줄
(빈 줄)
블로그 본문
=== 노션 전자책 ===
전자책블로그제목) 이 전자책을 블로그 자료 글로 올릴 때 쓸 헤드라인 제목(이모지 없이)
# 전자책 제목
전자책 본문(마크다운)
=== 확인할 것 ===
- 올리기 전에 공식 원문으로 확인할 숫자·사실 (없으면 "- 없음")`;
}
function parseExpand(text){
  const t = String(text || "").replace(/```[a-z]*\n?/g, "").replace(/\r/g, "");
  const sec = {}; const parts = t.split(/^===\s*(.+?)\s*===\s*$/m);
  for(let i = 1; i < parts.length; i += 2) sec[parts[i].trim()] = (parts[i + 1] || "").replace(/^\n+|\s+$/g, "");
  const blog = sec["블로그"] || ""; const ebookRaw = sec["노션 전자책"] || "";
  const bl = blog.split("\n"); const blogTitle = (bl.shift() || "").trim(); const blogBody = bl.join("\n").replace(/^\n+/, "");
  const m = ebookRaw.match(/^전자책블로그제목\)\s*(.+)$/m);
  const ebookTitle = m ? m[1].trim() : "";
  const ebookMd = ebookRaw.replace(/^전자책블로그제목\).*\n?/m, "").replace(/^\n+/, "");
  const checks = (sec["확인할 것"] || "").split("\n").map(x => x.replace(/^[-·*]\s*/, "").trim()).filter(x => x && x !== "없음");
  if(!blogTitle || blogBody.length < 300 || ebookMd.length < 200){ const e = new Error("형식"); e.code = "invalid_json"; throw e; }
  return { blogTitle, blogBody, ebookTitle: ebookTitle || ebookMd.match(/^#+\s*(.+)$/m)?.[1] || blogTitle, ebookMd, checks };
}
// 노션 마크다운 → 스마트에디터 초안 (무료자료_확장변환.py 와 같은 규칙: ### → 인용구, ** 벗김, --- 삭제, 불릿 ·, "1. " → "1.")
function mdToEditor(md){
  return md.split("\n").map(l => {
    if(/^#\s/.test(l)) return null;                         // 맨 위 # 제목은 블로그 제목 줄이 대신한다
    if(/^#{2,6}\s+/.test(l)) return "> " + l.replace(/^#{2,6}\s+/, "").replace(/\*\*/g, "");
    if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)) return null;
    let s = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]*)`/g, "$1");
    s = s.replace(/^\s*[-*]\s+\[ \]\s+/, "☐ ").replace(/^\s*[-*]\s+\[x\]\s+/i, "☑ ").replace(/^\s*[-*]\s+/, "· ");
    s = s.replace(/^(\s*)(\d+)\.\s+/, "$1$2.");
    return s.replace(/\s+$/, "");
  }).filter(l => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const stripEmoji = (s) => String(s).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
function slugOf(s){ return (String(s).replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 16)) || "대본"; }


// ── Claude 호출 ───────────────────────────────────────────
const claudeKey = () => LS.get('mb.claudeKey', '');
function client() { return new Anthropic({ apiKey: claudeKey(), dangerouslyAllowBrowser: true, maxRetries: 1 }); }
function parseJSON(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch { /* 아래로 */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { try { return JSON.parse(fence[1]); } catch { /* 아래로 */ } }
  const i = Math.min(...['{', '['].map((c) => { const k = t.indexOf(c); return k < 0 ? Infinity : k; }));
  const j = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (i < Infinity && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch { /* 아래로 */ } }
  const e = new Error('형식'); e.code = 'invalid_json'; throw e;
}
function textOf(msg) { return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''); }
function check(msg) {
  if (msg.stop_reason === 'refusal') { const e = new Error('refused'); e.code = 'refused'; throw e; }
  if (msg.stop_reason === 'max_tokens') { const e = new Error('cut'); e.code = 'cut'; throw e; }
}
// 대본·다듬기: Fable 5.1, 스트리밍(오래 생각함), 거절되면 서버가 다른 모델로 넘기도록 fallbacks
async function askBest(prompt, { signal, onLen } = {}) {
  let n = 0;
  const stream = client().beta.messages.stream({
    model: M_BEST, max_tokens: 32000, output_config: { effort: 'high' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  }, { signal });
  stream.on('text', (d) => { n += d.length; if (onLen) onLen(n); });
  const msg = await stream.finalMessage();
  check(msg); return textOf(msg);
}
function versionsFrom(text, inp) {
  let vs = parseScriptText(text, inp);
  if (!vs.length) { try { const j = normalize(parseJSON(text), inp); if (j.slots.length) vs = [j]; } catch { /* 아래로 */ } }
  if (!vs.length) { const e = new Error('형식'); e.code = 'invalid_json'; throw e; }
  return vs;
}
async function askMid(prompt) {
  const msg = await client().beta.messages.create({
    model: M_MID, max_tokens: 4000, output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  });
  check(msg); return parseJSON(textOf(msg));
}
async function askQuick(prompt) {
  const msg = await client().messages.create({ model: M_QUICK, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
  check(msg); return parseJSON(textOf(msg));
}
function errMsg(e) {
  if (e && e.code === 'invalid_json') return '대본 형식이 깨져서 왔어요. 한 번만 다시 눌러 주세요.';
  if (e && e.code === 'refused') return '이 내용은 대본으로 못 만들었어요. 표현을 바꿔서 다시 시도해 주세요.';
  if (e && e.code === 'cut') return '대본이 너무 길어져서 잘렸어요. 대강 대본을 줄이거나 길이를 짧게 골라 주세요.';
  if (e instanceof Anthropic.AuthenticationError) return 'Claude 열쇠가 틀렸어요. 설정 ④에서 다시 넣어 주세요.';
  if (e instanceof Anthropic.PermissionDeniedError) return '이 열쇠로는 이 모델을 쓸 수 없어요. Claude 콘솔에서 열쇠 권한을 확인해 주세요.';
  if (e instanceof Anthropic.RateLimitError) return '요청이 잠깐 몰렸어요. 1분 뒤에 다시 눌러 주세요.';
  if (e instanceof Anthropic.BadRequestError) return /credit/i.test(e.message || '') ? 'Claude 크레딧이 부족해요. 콘솔 Billing에서 충전해 주세요.' : `요청이 거절됐어요 (${e.message || 400})`;
  if (e instanceof Anthropic.APIConnectionError) return '인터넷 연결을 확인해 주세요.';
  if (e instanceof Anthropic.APIError) return `Claude 서버 오류 ${e.status || ''}. 조금 뒤에 다시 눌러 주세요.`;
  return '연결이 잠깐 끊겼어요. 다시 눌러 주세요.';
}
const isAbort = (e) => e instanceof Anthropic.APIUserAbortError || (e && e.name === 'AbortError');

// ── 완성대본 저장 (GitHub <아이디어뇌>/대본/YYYY-MM.json) ──────
let sq = LS.get('mb.sq', []);              // 아직 못 올린 작업
let scache = LS.get('mb.scache', {});       // { 'YYYY-MM': { entries, sha } }
let sflushing = false;
const scriptDir = () => { const d = SW.cfg().dir.replace(/\/+$/, ''); return (d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : d) + '/대본'; };
const sFile = (month) => `${SW.repoPath()}/contents/${scriptDir().split('/').filter(Boolean).map(encodeURIComponent).join('/')}/${month}.json`;
const monthOfAt = (at) => at.slice(0, 7);
function months() {
  const out = []; const d = new Date(); let m = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  while (m >= FIRST_MONTH && out.length < 24) { out.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; }
  return out;
}
async function sLoad(month) {
  let meta;
  try { meta = await SW.gh(`${sFile(month)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`); }
  catch (e) { if (e.status === 404) return { entries: [], sha: null }; throw e; }
  let raw = meta.content;
  if (!raw && meta.size > 0) raw = (await SW.gh(`${SW.repoPath()}/git/blobs/${meta.sha}`)).content;
  const data = JSON.parse(SW.b64decode(raw || '') || '{}');
  return { entries: Array.isArray(data.entries) ? data.entries : [], sha: meta.sha };
}
async function sSave(month, entries, sha, message) {
  const body = { version: 1, month, note: '소원저장소 앱이 쌓는 완성 대본. 슬롯 형식은 아이디어뇌/README.md', entries };
  const res = await SW.gh(sFile(month), { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(body, null, 2) + '\n'), ...(sha ? { sha } : {}) } });
  return res.content.sha;
}
function sApply(entries, ops) {
  const list = entries.map((e) => ({ ...e }));
  for (const op of ops) {
    if (op.op === 'add') { const i = list.findIndex((e) => e.id === op.entry.id); if (i >= 0) list[i] = op.entry; else list.push(op.entry); }
    else if (op.op === 'edit') { const t = list.find((e) => e.id === op.id); if (t) Object.assign(t, op.patch); }
    else if (op.op === 'del') { const i = list.findIndex((e) => e.id === op.id); if (i >= 0) list.splice(i, 1); }
  }
  return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
function persistS() { LS.set('mb.sq', sq); LS.set('mb.scache', scache); }
async function sFlush() {
  if (sflushing || !SW.cfg().token || !sq.length || !navigator.onLine) { renderScripts(); return; }
  sflushing = true;
  try {
    for (const month of [...new Set(sq.map((o) => o.month))].sort()) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const ops = sq.filter((o) => o.month === month); if (!ops.length) break;
        const f = await sLoad(month);
        const entries = sApply(f.entries, ops);
        try {
          const d = new Date();
          const sha = await sSave(month, entries, f.sha, `대본 ${ops.length}건 (${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())})`);
          sq = sq.filter((o) => !ops.includes(o)); scache[month] = { entries, sha }; persistS(); break;
        } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
      }
    }
  } catch (e) { toast(`대본 올리기 실패: ${e.message || e}`); }
  finally { sflushing = false; renderScripts(); }
}
async function sRefresh() {
  if (!SW.cfg().token || !navigator.onLine) return;
  try { for (const m of months()) { const f = await sLoad(m); scache[m] = f; } persistS(); renderScripts(); }
  catch { /* 조용히: 다음에 다시 */ }
}
function allScripts() {
  const map = new Map();
  Object.values(scache).forEach((f) => (f.entries || []).forEach((e) => map.set(e.id, { ...e })));
  sq.forEach((op) => {
    if (op.op === 'add') map.set(op.entry.id, { ...op.entry, _wait: true });
    else if (op.op === 'edit') { const t = map.get(op.id); if (t) Object.assign(t, op.patch, { _wait: true }); }
    else if (op.op === 'del') map.delete(op.id);
  });
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
function sPut(entry) { sq = sq.filter((o) => !(o.op === 'add' && o.entry.id === entry.id)); sq.push({ op: 'add', month: monthOfAt(entry.createdAt), entry }); persistS(); renderScripts(); sFlush(); }
function sDel(entry) { sq = sq.filter((o) => !(o.op === 'add' && o.entry.id === entry.id)); sq.push({ op: 'del', month: monthOfAt(entry.createdAt), id: entry.id }); persistS(); renderScripts(); sFlush(); }

// ── 저장소 글 읽기·쓰기 (블로그 확장용) ────────────────────
const repoFile = (path) => `${SW.repoPath()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
async function ghReadText(path) {
  const meta = await SW.gh(`${repoFile(path)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`);
  let raw = meta.content;
  if (!raw && meta.size > 0) raw = (await SW.gh(`${SW.repoPath()}/git/blobs/${meta.sha}`)).content;
  return SW.b64decode(raw || '');
}
async function ghWriteText(path, text, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let sha = null;
    try { sha = (await SW.gh(`${repoFile(path)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    try { await SW.gh(repoFile(path), { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(text), ...(sha ? { sha } : {}) } }); return; }
    catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
  }
}

// ── 녹화한 대본 → 블로그 초안 + 노션 전자책 → 확장 ──────────
let expandCtl = null;
async function expandScript(x) {
  if (!claudeKey()) { toast('설정 ④에 Claude 열쇠를 넣어 주세요'); SW.openSettings(); return; }
  if (!SW.cfg().token) { toast('설정 ①에 GitHub 열쇠를 넣어 주세요'); SW.openSettings(); return; }
  if (!navigator.onLine) { toast('인터넷이 연결돼야 만들 수 있어요'); return; }
  S.expandBusy = x.id; S.expandMsg = '블로그 규칙 문서 읽는 중…'; renderSheet();
  expandCtl = new AbortController();
  try {
    const docs = [];
    for (const [name, path, heads] of EXPAND_DOCS) {
      try { const t = await ghReadText(path); docs.push({ name, text: heads ? pickSections(t, heads) : t }); }
      catch (e) { if (e.status !== 404) throw e; }
    }
    S.expandMsg = 'Fable이 블로그 글과 전자책을 쓰는 중… 2~4분'; renderSheet();
    const text = await askBest(buildExpandPrompt(x, docs), { signal: expandCtl.signal, onLen: (n) => { S.expandMsg = `쓰는 중… ${n}자`; const el = $('#expandMsg'); if (el) el.textContent = S.expandMsg; } });
    const r = parseExpand(text);
    S.expandMsg = '저장소에 넣는 중…'; renderSheet();
    const day = today(); const slug = slugOf(x.topic || x.title);
    const base = `네이버블로그/자동초안/${day}/초안0_`;
    const blogPath = `${base}대본_${slug}.txt`, ebookPath = `${base}자료_${slug}전자책.txt`, mdPath = `캐러셀/무료자료_${day}_${slug}.md`;
    const msg = `대본 확장: 블로그·전자책 ${slug}`;
    await ghWriteText(blogPath, `${stripEmoji(r.blogTitle)}

${r.blogBody.trim()}
`, msg);
    await ghWriteText(ebookPath, `${stripEmoji(r.ebookTitle)}

${mdToEditor(r.ebookMd)}
`, msg);
    await ghWriteText(mdPath, r.ebookMd.trim() + '\n', msg);
    const pin = '소원저장소 앱에서 녹화한 대본으로 만든 글 — 확장 목록 맨 위에 띄움\n';
    await ghWriteText(blogPath.replace(/\.txt$/, '.상단고정'), pin, msg);
    await ghWriteText(ebookPath.replace(/\.txt$/, '.상단고정'), pin, msg);
    const cur = allScripts().find((s) => s.id === x.id) || x;
    const clean = { ...cur }; delete clean._wait;
    sPut({ ...clean, status: (cur.status || '초안') === '초안' ? '촬영완료' : cur.status, updatedAt: localISO(),
      expand: { at: localISO(), blogTitle: stripEmoji(r.blogTitle), blogBody: r.blogBody, ebookTitle: stripEmoji(r.ebookTitle), ebookMd: r.ebookMd, checks: r.checks, blogPath, ebookPath, mdPath } });
    toast('확장에 넣었어요. 맥북이 켜져 있으면 5분 안에 목록 맨 위에 떠요');
  } catch (e) { if (!isAbort(e)) toast(e && e.status ? `저장소 오류: ${e.message}` : errMsg(e)); }
  finally { S.expandBusy = null; S.expandMsg = ''; expandCtl = null; renderSheet(); }
}
function expandHtml(x) {
  const busy = S.expandBusy === x.id;
  const e = x.expand;
  let h = `<div class="sc-box sc-expand"><b>녹화했으면 · 블로그 확장에 넣기</b>`;
  if (busy) return h + `<div class="sc-busy"><div class="pbar"><i></i></div><p id="expandMsg">${esc(S.expandMsg)}</p><button class="ghost-btn" type="button" data-act="expandStop">그만</button></div></div>`;
  if (e) {
    h += `<p class="hint small">✔ ${esc(e.at.slice(5, 10).replace('-', '/'))} ${esc(e.at.slice(11, 16))}에 넣었어요. 확장 목록 맨 위(${esc(e.blogPath.split('/')[2])})에 떠요.</p>
      <ul class="sc-files"><li>블로그: ${esc(e.blogTitle)}</li><li>전자책: ${esc(e.ebookTitle)}</li></ul>
      ${e.checks && e.checks.length ? `<div class="sc-box warn"><b>올리기 전에 확인</b><ul>${e.checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      <div class="sc-btns"><button class="ghost-btn" type="button" data-act="copyEbook">전자책 복사(노션용)</button><button class="ghost-btn" type="button" data-act="copyBlog">블로그 글 복사</button></div>
      <button class="ghost-btn" type="button" data-act="expand">다시 만들기 <span class="tier">Fable 5.1</span></button>`;
  } else {
    h += `<p class="hint small">이 대본으로 네이버 블로그 글과 노션 전자책(댓글${x.ctaKeyword ? ` '${esc(x.ctaKeyword)}'` : ''} 자료)을 만들어 크롬 확장 목록 맨 위에 넣어요. 블로그 규칙 문서는 저장소 최신본을 읽어요.</p>
      <button class="aqua-btn small" type="button" data-act="expand">📝 블로그·전자책 만들어 확장에 넣기 <span class="tier">Fable 5.1</span></button>`;
  }
  return h + '</div>';
}

// ── 상태 ─────────────────────────────────────────────────
const S = {
  current: LS.get('sw.current', null), editing: false,
  attached: new Set(LS.get('sw.attached', [])),
  scFilter: '전체', scQ: '', openId: null, sheetEditing: false, sheetConfirm: false,
  hooks: null, hooksBusy: false, revBusy: false, sugg: {}, alts: LS.get('sw.alts', []),
};
if (S.alts.length) S.current = S.alts[LS.get('sw.altIdx', 0)] || S.alts[0];
function persistCur() {
  LS.set('sw.current', S.current);
  const i = S.alts.indexOf(S.current);
  if (i >= 0) { LS.set('sw.alts', S.alts); LS.set('sw.altIdx', i); } else { S.alts = []; LS.set('sw.alts', []); }
}
const ideas = () => SW.entries();

// ── 대본 만들기 폼 ────────────────────────────────────────
function fillSelect(id, opts, val) { $(id).innerHTML = opts.map((o) => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join(''); }
function readForm() {
  return { topic: $('#mTopic').value.trim(), rough: $('#mRough').value.trim(), facts: $('#mFacts').value.trim(),
    struct: $('#mStruct').value, hook: $('#mHook').value, tone: $('#mTone').value, len: $('#mLen').value, cta: $('#mCta').value.trim().replace(/['"]/g, '') };
}
function saveForm() { LS.set('sw.form', readForm()); }
function renderAttach() {
  const box = $('#attachList'); if (!box) return;
  const pool = ideas().filter((x) => S.attached.has(x.id) || !(x.used && x.used.length)).slice(0, 30);
  if (!pool.length) { box.innerHTML = '<p class="hint">말하기로 쌓은 메모가 여기 떠요.</p>'; return; }
  box.innerHTML = pool.map((x) => `<label><input type="checkbox" data-id="${esc(x.id)}"${S.attached.has(x.id) ? ' checked' : ''}><span>${x.kind ? `<span class="tag">${esc(x.kind)}</span> ` : ''}${esc(String(x.text).slice(0, 80))}${String(x.text).length > 80 ? '…' : ''}</span></label>`).join('');
}
function renderKeyHint() {
  const has = !!claudeKey();
  $('#genBtn').innerHTML = has ? '대본 뽑기 <span class="tier">Fable 5.1</span>' : '대본 뽑기 <span class="tier">열쇠 필요</span>';
}
function setBusy(on, text) { $('#genBusy').hidden = !on; $('#genBtn').disabled = on; if (text) $('#genBusyText').textContent = text; }
function showErr(msg, withCopy) {
  const b = $('#genErr');
  if (!msg) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  b.innerHTML = `<b>잠깐</b><div>${esc(msg)}</div>${withCopy ? '<div class="sc-btns"><button class="ghost-btn" type="button" data-act="openKey">설정 ④ 열기</button><button class="ghost-btn" type="button" data-act="copyPrompt">프롬프트 복사</button></div>' : ''}`;
}
let genCtl = null;
async function generate() {
  const inp = readForm(); saveForm();
  if (!inp.topic && !inp.rough) { toast('주제나 대강 대본 중 하나는 적어 주세요'); return; }
  const att = ideas().filter((x) => S.attached.has(x.id));
  showErr('');
  if (!claudeKey()) { showErr('Claude 열쇠가 아직 없어요. 설정 ④에 열쇠를 넣거나, "프롬프트 복사"로 Claude 앱에 붙여 넣고 답을 아래 "답 붙여넣기"에 넣어 주세요.', true); return; }
  genCtl = new AbortController();
  setBusy(true, 'Fable이 대본을 생각하는 중… 1~3분쯤 걸려요');
  try {
    const text = await askBest(buildPrompt(inp, att), { signal: genCtl.signal, onLen: (n) => { $('#genBusyText').textContent = `두 버전 쓰는 중… ${n}자`; } });
    const vs = versionsFrom(text, inp);
    vs.forEach((v) => { v.ideaIds = att.map((x) => x.id); });
    setCurrent(vs[0], vs);
    $('#resultWin').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { if (!isAbort(e)) showErr(errMsg(e)); }
  finally { setBusy(false); genCtl = null; }
}
function setCurrent(sc, alts) {
  S.current = sc; S.editing = false; S.hooks = null;
  if (alts) S.alts = alts;
  persistCur(); renderResult();
}

// ── 결과 화면 ────────────────────────────────────────────
const EXAMPLE = {
  example: true,
  title: 'S&P500 아무거나 사지 마세요. ETF 고르는 기준 총정리',
  cover: ['S&P500', '아무거나 사지 마세요'], structure: '문제해결형', hookType: '부정·경고',
  why: '인기 대본 3번을 이 앱 형식으로 옮긴 예시예요. 위에 주제를 적고 "대본 뽑기"를 누르면 여기가 바뀌어요.',
  slots: [
    { slot: '후킹', lines: [{ text: 'S&P 500 아무거나 사는 거 아니시죠?', visual: '큰 🤔 + 흠…' }] },
    { slot: '베네핏 - 주제', lines: [{ text: 'S&P 500 똑똑하게 사는 꿀팁', visual: 'S&P500 ETF 로고 3개 나란히' }] },
    { slot: '공감유도 or 문제점 제시', lines: [{ text: '검색하면 엄청 많이 나오는데, 아무거나 사면 똑같이 투자해도 나만 수백만 원 손해 볼 수 있어요.', visual: '검색 결과 캡처 + 😭' }] },
    { slot: '문제해결', lines: [{ text: '수익률, 추적오차율, 배당 규모 이렇게 기준 두고 고르시면 되는데,', visual: '비교표 캡처에 빨간 박스' }, { text: '제일 똑똑하게 사는 방법까지 싹 다 정리해 놨으니까', visual: '정리 문서 흐리게 + 목차 글씨' }] },
    { slot: 'CTA', lines: [{ text: "팔로우하고 댓글에 '500' 남겨 주세요.", visual: '⌨️ 키보드 + 📈' }] },
  ],
  ctaKeyword: '500', caption: '', hashtags: [], needCheck: [], usedIdeaIds: [], topic: '', input: {},
};
function phoneHtml(sc) { return `<div class="sc-phone" aria-hidden="true"><div class="t">${(sc.cover || []).map((c) => `<span>${esc(c)}</span>`).join('')}</div><div class="ph">사진 자리</div><div class="b">신혼테크</div></div>`; }
function slotsHtml(sc, editing, hookBtn) {
  return `<div class="sc-slots">${sc.slots.map((s, si) => {
    const cls = si === 0 ? ' hook' : /cta/i.test(s.slot) ? ' cta' : '';
    return `<div class="sc-slot${cls}"><div class="sc-slot-name">${esc(s.slot)})${si === 0 && hookBtn ? '<button class="mini-btn" type="button" data-act="hooks">후킹 바꾸기 <span class="tier">Sonnet</span></button>' : ''}</div>
      ${s.lines.map((l, li) => (editing
        ? `<div class="sc-line"><textarea class="paper" data-si="${si}" data-li="${li}" data-f="text">${esc(l.text)}</textarea><textarea class="paper v" data-si="${si}" data-li="${li}" data-f="visual" placeholder="화면요소">${esc(l.visual)}</textarea></div>`
        : `<div class="sc-line"><div class="say">${esc(l.text)}</div>${l.visual ? `<div class="vis">( ${esc(l.visual)} )</div>` : ''}</div>`)).join('')}
    </div>`;
  }).join('')}</div>`;
}
function checksHtml(sc) { return `<div class="sc-checks">${analyze(sc).map((c) => `<span class="ck ${c.c}"${c.tip ? ` title="${esc(c.tip)}"` : ''}>${esc(c.k)}</span>`).join('')}</div>`; }
function extrasHtml(sc) {
  let h = '';
  if (sc.needCheck && sc.needCheck.length) h += `<div class="sc-box warn"><b>올리기 전에 공식 원문으로 확인</b><ul>${sc.needCheck.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  if (sc.caption) h += `<div class="sc-box"><b>캡션</b><div class="cap">${esc(sc.caption)}</div>${sc.hashtags && sc.hashtags.length ? `<div class="tags">${esc(sc.hashtags.join(' '))}</div>` : ''}</div>`;
  return h;
}
function headHtml(sc, sub) {
  return `<div class="sc-head">${phoneHtml(sc)}<div class="sc-head-main">
    <div class="chips"><span class="tag">${esc(sc.structure || '구조')}</span><span class="tag used">${esc(sc.hookType || '후킹')}</span>${sc.ctaKeyword ? `<span class="tag">댓글 '${esc(sc.ctaKeyword)}'</span>` : ''}${sc.example ? '<span class="tag wait">예시</span>' : ''}</div>
    <h3>${esc(sc.title)}</h3>${sub ? `<p class="hint">${esc(sub)}</p>` : ''}</div></div>`;
}
function renderResult() {
  const sc = S.current || EXAMPLE;
  $('#resultTitle').textContent = sc.example ? '♡ example_script.txt' : '♡ new_script.txt';
  const ed = S.editing && !sc.example;
  const alts = !sc.example && S.alts && S.alts.length > 1 ? S.alts : null;
  $('#resultBody').innerHTML = `
    ${alts ? `<div class="chips sc-alts" role="group" aria-label="버전">${alts.map((v, i) => `<button class="chip${v === sc ? ' is-on' : ''}" type="button" data-act="alt" data-i="${i}" aria-pressed="${v === sc}">${esc(v.label || '버전 ' + (i + 1))}</button>`).join('')}</div>` : ''}
    ${headHtml(sc, sc.why)}
    ${checksHtml(sc)}
    ${S.hooksBusy ? '<div class="sc-busy"><div class="pbar"><i></i></div><p>후킹 후보 뽑는 중…</p></div>' : ''}
    ${S.hooks ? `<div class="sc-box"><b>후킹 후보 · 누르면 바뀌어요</b><div class="sc-hooks">${S.hooks.map((h, i) => `<button type="button" data-act="useHook" data-i="${i}"><em>${esc(h.hookType)}</em>${esc(h.text)}</button>`).join('')}</div></div>` : ''}
    ${slotsHtml(sc, ed, !ed && !sc.example)}
    ${extrasHtml(sc)}
    ${sc.example ? '' : `
    <label class="lab" for="revText">다듬기 <small>예: 더 짧게, 후킹을 조건 제시로, 숫자 줄여서</small></label>
    <textarea id="revText" class="paper" rows="2" placeholder="고치고 싶은 점을 적어요">${esc(LS.get('sw.rev', ''))}</textarea>
    ${S.revBusy ? '<div class="sc-busy"><div class="pbar"><i></i></div><p id="revBusyText">Fable이 다듬는 중… 1~2분</p><button class="ghost-btn" type="button" data-act="revStop">그만</button></div>' : '<button class="ghost-btn" type="button" data-act="revise">다듬기 <span class="tier">Fable 5.1</span></button>'}
    <div class="sc-btns">
      ${ed ? '<button class="aqua-btn small" type="button" data-act="editDone">고친 거 반영</button><button class="ghost-btn" type="button" data-act="editCancel">취소</button>'
           : '<button class="aqua-btn small" type="button" data-act="save">★ 완성대본에 저장</button><button class="ghost-btn" type="button" data-act="edit">직접 고치기</button>'}
      <button class="ghost-btn" type="button" data-act="copyFull">대본 복사</button>
      <button class="ghost-btn" type="button" data-act="copySay">자막만 복사</button>
      <button class="ghost-btn" type="button" data-act="regen">다시 뽑기</button>
    </div>`}`;
  const rv = $('#revText'); if (rv) rv.addEventListener('input', (e) => LS.set('sw.rev', e.target.value));
}
let revCtl = null;
async function onResultClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const sc = S.current; if (!sc) return;
  const act = b.dataset.act;
  if (act === 'alt') { const v = S.alts[+b.dataset.i]; if (v) { S.current = v; S.editing = false; S.hooks = null; persistCur(); renderResult(); } return; }
  if (act === 'copyFull') copyText(scriptText(sc), '대본');
  else if (act === 'copySay') copyText(scriptText(sc, 'say'), '자막');
  else if (act === 'regen') generate();
  else if (act === 'edit') { S.editing = true; renderResult(); }
  else if (act === 'editCancel') { S.editing = false; renderResult(); }
  else if (act === 'editDone') {
    $('#resultBody').querySelectorAll('textarea[data-si]').forEach((t) => { sc.slots[+t.dataset.si].lines[+t.dataset.li][t.dataset.f] = t.value.trim(); });
    sc.slots.forEach((s) => { s.lines = s.lines.filter((l) => l.text); }); sc.slots = sc.slots.filter((s) => s.lines.length);
    S.editing = false; persistCur(); renderResult(); toast('반영했어요');
  }
  else if (act === 'save') saveCurrent();
  else if (act === 'hooks') {
    if (!claudeKey()) { toast('설정 ④에 Claude 열쇠를 넣어 주세요'); return; }
    S.hooksBusy = true; S.hooks = null; renderResult();
    try {
      const res = await askMid(`${RULES}\n\n[주문] 아래 대본의 후킹 슬롯만 다시 써. 서로 다른 후킹 유형으로 6개. 각 공백 빼고 16~20자, 요체, 대본 속 숫자만 쓰고 새 숫자는 만들지 마. 다음 줄(베네핏)과 이어져야 한다.\nJSON 배열만: [{"hookType":"유형","text":"후킹 문장"}]\n\n[대본]\n${scriptText(sc)}`);
      S.hooks = (Array.isArray(res) ? res : []).map((h) => ({ hookType: String(h.hookType || ''), text: String(h.text || '') })).filter((h) => h.text).slice(0, 6);
    } catch (err) { toast(errMsg(err)); }
    S.hooksBusy = false; renderResult();
  }
  else if (act === 'useHook') {
    const h = S.hooks && S.hooks[+b.dataset.i]; if (!h) return;
    sc.slots[0].lines = [{ text: h.text, visual: sc.slots[0].lines[0] ? sc.slots[0].lines[0].visual : '' }];
    if (h.hookType) sc.hookType = h.hookType;
    S.hooks = null; persistCur(); renderResult(); toast('후킹을 바꿨어요');
  }
  else if (act === 'revStop') { if (revCtl) revCtl.abort(); }
  else if (act === 'revise') {
    const ins = ($('#revText').value || '').trim(); if (!ins) { toast('어떻게 고칠지 적어 주세요'); return; }
    if (!claudeKey()) { toast('설정 ④에 Claude 열쇠를 넣어 주세요'); return; }
    revCtl = new AbortController(); S.revBusy = true; renderResult();
    try {
      const text = await askBest(buildRevisePrompt(sc, ins),
        { signal: revCtl.signal, onLen: (n) => { const t = $('#revBusyText'); if (t) t.textContent = `고치는 중… ${n}자`; } });
      const nsc = versionsFrom(text, sc.input || {})[0];
      nsc.label = '다듬은 버전'; nsc.ideaIds = sc.ideaIds || []; nsc.savedId = sc.savedId; nsc.createdAt = sc.createdAt;
      const alts = (S.alts && S.alts.includes(sc) ? S.alts : [sc]).concat([nsc]);
      LS.set('sw.rev', ''); S.revBusy = false; revCtl = null; setCurrent(nsc, alts); toast('다듬었어요. 위 버튼으로 전 버전과 비교할 수 있어요'); return;
    } catch (err) { if (!isAbort(err)) toast(errMsg(err)); }
    S.revBusy = false; revCtl = null; renderResult();
  }
}

function saveCurrent() {
  const sc = S.current; if (!sc || sc.example) return;
  const now = new Date();
  const old = sc.savedId ? allScripts().find((x) => x.id === sc.savedId) : null;
  const entry = {
    id: sc.savedId || SW.makeId(now), title: sc.title, cover: sc.cover, structure: sc.structure, hookType: sc.hookType, why: sc.why,
    slots: sc.slots, ctaKeyword: sc.ctaKeyword, caption: sc.caption, hashtags: sc.hashtags, needCheck: sc.needCheck,
    topic: sc.topic, input: sc.input || {}, ideaIds: sc.ideaIds || [],
    status: old ? old.status : '초안', createdAt: old ? old.createdAt : (sc.createdAt || localISO(now)), updatedAt: localISO(now),
  };
  sPut(entry);
  sc.savedId = entry.id; sc.createdAt = entry.createdAt; persistCur();
  const used = new Set(sc.usedIdeaIds && sc.usedIdeaIds.length ? sc.usedIdeaIds : (sc.ideaIds || []));
  used.forEach((id) => { SW.markUsed(id, sc.title); S.attached.delete(id); });
  LS.set('sw.attached', [...S.attached]); renderAttach();
  toast(old ? '완성대본을 새 버전으로 바꿨어요 ★' : '완성대본목록에 저장했어요 ★');
}

// ── 붙여넣기(열쇠 없이 Claude 앱으로 뽑은 답) ─────────────
function applyPasted() {
  const raw = $('#pasteBox').value.trim(); if (!raw) { toast('Claude 답을 붙여 넣어 주세요'); return; }
  try {
    const inp = readForm();
    const vs = versionsFrom(raw, inp);
    const ids = ideas().filter((x) => S.attached.has(x.id)).map((x) => x.id); vs.forEach((v) => { v.ideaIds = ids; });
    $('#pasteBox').value = ''; setCurrent(vs[0], vs); toast('붙여 넣은 대본을 열었어요');
    $('#resultWin').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch { toast('대본 형식을 못 읽었어요. Claude 답 전체를 그대로 붙여 넣어 주세요'); }
}

// ── 복사 ─────────────────────────────────────────────────
async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); toast(`${label || ''} 복사했어요`); }
  catch { $('#copyArea').value = text; $('#copySheet').showModal(); $('#copyArea').select(); }
}

// ── 완성대본목록 ─────────────────────────────────────────
function hookOf(x) { return x.slots && x.slots[0] ? x.slots[0].lines.map((l) => l.text).join(' ') : ''; }
function renderScripts() {
  const all = allScripts();
  const cnt = $('#scriptCount'); if (cnt) cnt.textContent = all.length ? String(all.length) : '';
  $('#scFilter').innerHTML = ['전체'].concat(STATUSES).map((k) => {
    const n = k === '전체' ? all.length : all.filter((x) => (x.status || '초안') === k).length;
    return `<button class="chip${k === S.scFilter ? ' is-on' : ''}" type="button" data-f="${k}" aria-pressed="${k === S.scFilter}">${k} ${n}</button>`;
  }).join('');
  let list = all;
  if (S.scFilter !== '전체') list = list.filter((x) => (x.status || '초안') === S.scFilter);
  if (S.scQ) list = list.filter((x) => [x.title, x.topic, hookOf(x), (x.cover || []).join(' ')].join(' ').includes(S.scQ));
  const box = $('#scList');
  if (!list.length) {
    box.innerHTML = `<div class="empty"><b>📼</b>${all.length ? '조건에 맞는 대본이 없어요' : '아직 완성 대본이 없어요. 대본 탭에서 뽑고 ★ 저장을 누르면 여기 쌓여요'}</div>`;
  } else {
    box.innerHTML = list.map((x) => {
      const st = x.status || '초안';
      const len = (x.slots || []).map((s) => s.lines.map((l) => l.text).join(' ')).join(' ').length;
      return `<button class="sc-card" type="button" data-id="${esc(x.id)}">
        <span class="bar"><span>${fmtDate(x.createdAt)} · ${esc(x.structure || '')}</span><span class="st st-${esc(st)}">${esc(st)}</span></span>
        <span class="in"><span class="hk">${esc(hookOf(x))}</span><span class="ti">${esc(x.title)}</span>
        <span class="chips"><span class="tag used">${esc(x.hookType || '후킹')}</span><span class="tag">${len}자</span>${x.ctaKeyword ? `<span class="tag">'${esc(x.ctaKeyword)}'</span>` : ''}${x._wait ? '<span class="tag wait">⏳ 올리는 중</span>' : ''}</span></span>
      </button>`;
    }).join('');
  }
  if (S.openId) renderSheet();
}
function renderSheet() {
  const x = allScripts().find((s) => s.id === S.openId);
  const dlg = $('#scriptSheet');
  if (!x) { if (dlg.open) dlg.close(); S.openId = null; return; }
  const st = x.status || '초안';
  $('#sheetTitle').textContent = `★ ${x.title}`;
  $('#sheetBody').innerHTML = `
    ${headHtml(x, `${x.createdAt.slice(0, 10)} 저장${x.updatedAt && x.updatedAt !== x.createdAt ? ` · ${x.updatedAt.slice(0, 10)} 고침` : ''}`)}
    <div class="chips" role="group" aria-label="상태">${STATUSES.map((k) => `<button class="chip${k === st ? ' is-on' : ''}" type="button" data-st="${k}" aria-pressed="${k === st}">${k}</button>`).join('')}</div>
    ${checksHtml(x)}
    ${expandHtml(x)}
    ${slotsHtml(x, S.sheetEditing, false)}
    ${extrasHtml(x)}
    <div class="sc-btns">
      ${S.sheetEditing ? '<button class="aqua-btn small" type="button" data-act="sEditDone">고친 거 저장</button><button class="ghost-btn" type="button" data-act="sEditCancel">취소</button>'
        : '<button class="aqua-btn small" type="button" data-act="sCopy">대본 복사</button><button class="ghost-btn" type="button" data-act="sSay">자막만</button><button class="ghost-btn" type="button" data-act="sCap">캡션</button><button class="ghost-btn" type="button" data-act="sEdit">고치기</button><button class="ghost-btn" type="button" data-act="sRework">다시 다듬기</button>'}
    </div>
    <div class="sc-btns">${S.sheetConfirm ? '<button class="danger-btn" type="button" data-act="sReallyDel">정말 지우기</button><button class="ghost-btn" type="button" data-act="sCancelDel">남겨 두기</button>' : '<button class="ghost-btn" type="button" data-act="sDel">이 대본 지우기</button>'}</div>`;
  if (!dlg.open) dlg.showModal();
}
function onSheetClick(e) {
  const x = allScripts().find((s) => s.id === S.openId); if (!x) return;
  const st = e.target.closest('[data-st]');
  if (st) { sPut({ ...x, _wait: undefined, status: st.dataset.st, updatedAt: localISO() }); toast(`${st.dataset.st}(으)로 바꿨어요`); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  const clean = (o) => { const c = { ...o }; delete c._wait; return c; };
  if (act === 'expand') { expandScript(x); return; }
  if (act === 'expandStop') { if (expandCtl) expandCtl.abort(); return; }
  if (act === 'copyEbook' && x.expand) { copyText(x.expand.ebookMd, '전자책'); return; }
  if (act === 'copyBlog' && x.expand) { copyText(`${x.expand.blogTitle}\n\n${x.expand.blogBody}`, '블로그 글'); return; }
  if (act === 'sCopy') copyText(scriptText(x), '대본');
  else if (act === 'sSay') copyText(scriptText(x, 'say'), '자막');
  else if (act === 'sCap') copyText(scriptText(x, 'caption'), '캡션');
  else if (act === 'sEdit') { S.sheetEditing = true; renderSheet(); }
  else if (act === 'sEditCancel') { S.sheetEditing = false; renderSheet(); }
  else if (act === 'sEditDone') {
    const slots = JSON.parse(JSON.stringify(x.slots));
    $('#sheetBody').querySelectorAll('textarea[data-si]').forEach((t) => { slots[+t.dataset.si].lines[+t.dataset.li][t.dataset.f] = t.value.trim(); });
    slots.forEach((s) => { s.lines = s.lines.filter((l) => l.text); });
    S.sheetEditing = false; sPut({ ...clean(x), slots: slots.filter((s) => s.lines.length), updatedAt: localISO() }); toast('저장했어요');
  }
  else if (act === 'sRework') {
    const c = clean(JSON.parse(JSON.stringify(x)));
    setCurrent({ ...c, savedId: x.id, usedIdeaIds: [], ideaIds: x.ideaIds || [] }, []);
    $('#scriptSheet').close(); S.openId = null; SW.switchTab('make');
    setTimeout(() => $('#resultWin').scrollIntoView({ block: 'start' }), 60);
    toast('대본 탭으로 옮겼어요. 다듬고 다시 ★ 저장하면 덮어써요');
  }
  else if (act === 'sDel') { S.sheetConfirm = true; renderSheet(); }
  else if (act === 'sCancelDel') { S.sheetConfirm = false; renderSheet(); }
  else if (act === 'sReallyDel') { S.sheetConfirm = false; S.openId = null; $('#scriptSheet').close(); sDel(x); toast('지웠어요'); }
}

// ── 설정 ④ Claude 열쇠 ───────────────────────────────────
async function saveKey() {
  const v = $('#claudeKey').value.trim();
  const msg = (t, c) => { const m = $('#claudeMsg'); m.textContent = t; m.className = 'msg' + (c ? ' ' + c : ''); };
  if (!v) { msg('열쇠를 먼저 붙여넣어 주세요', 'err'); return; }
  const before = claudeKey(); LS.set('mb.claudeKey', v); msg('확인하는 중…', ''); $('#claudeSave').disabled = true;
  try {
    await client().messages.create({ model: M_QUICK, max_tokens: 8, messages: [{ role: 'user', content: '네' }] });
    $('#claudeKey').value = ''; msg('연결됐어요 ✔ 이제 대본 뽑기를 쓸 수 있어요', 'ok');
  } catch (e) { LS.set('mb.claudeKey', before); msg(errMsg(e), 'err'); }
  finally { $('#claudeSave').disabled = false; renderKeyState(); }
}
function forgetKey() { LS.set('mb.claudeKey', ''); renderKeyState(); toast('Claude 열쇠를 지웠어요'); }
function renderKeyState() {
  const has = !!claudeKey();
  $('#claudeKey').placeholder = has ? '열쇠가 들어 있어요 · 바꾸려면 새로 붙여넣기' : 'sk-ant-… 붙여넣기';
  $('#claudeForget').hidden = !has; renderKeyHint();
}

// ── 시작 ─────────────────────────────────────────────────
function init() {
  const f = LS.get('sw.form', {});
  fillSelect('#mStruct', ['자동'].concat(Object.keys(STRUCTS)), f.struct || '자동');
  fillSelect('#mHook', ['자동'].concat(HOOKS.map((h) => h[0])), f.hook || '자동');
  fillSelect('#mTone', Object.keys(TONES), f.tone || '보보스식 요체');
  fillSelect('#mLen', Object.keys(LENS), f.len || Object.keys(LENS)[0]);
  $('#mTopic').value = f.topic || ''; $('#mRough').value = f.rough || ''; $('#mFacts').value = f.facts || ''; $('#mCta').value = f.cta || '';
  ['#mTopic', '#mRough', '#mFacts', '#mCta'].forEach((s) => $(s).addEventListener('input', saveForm));
  ['#mStruct', '#mHook', '#mTone', '#mLen'].forEach((s) => $(s).addEventListener('change', saveForm));
  $('#attachList').addEventListener('change', (e) => {
    const c = e.target.closest('input[data-id]'); if (!c) return;
    if (c.checked) S.attached.add(c.dataset.id); else S.attached.delete(c.dataset.id);
    LS.set('sw.attached', [...S.attached]);
  });
  $('#genBtn').addEventListener('click', generate);
  $('#genStop').addEventListener('click', () => { if (genCtl) genCtl.abort(); });
  $('#genErr').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'openKey') SW.openSettings();
    if (b.dataset.act === 'copyPrompt') copyText(buildPrompt(readForm(), ideas().filter((x) => S.attached.has(x.id))), '프롬프트');
  });
  $('#copyPromptBtn').addEventListener('click', () => { const inp = readForm(); if (!inp.topic && !inp.rough) { toast('주제나 대강 대본을 먼저 적어 주세요'); return; } copyText(buildPrompt(inp, ideas().filter((x) => S.attached.has(x.id))), '프롬프트'); });
  $('#pasteApply').addEventListener('click', applyPasted);
  $('#resultBody').addEventListener('click', onResultClick);
  $('#scFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; S.scFilter = b.dataset.f; renderScripts(); });
  $('#scQ').addEventListener('input', (e) => { S.scQ = e.target.value.trim(); renderScripts(); });
  $('#scList').addEventListener('click', (e) => { const c = e.target.closest('[data-id]'); if (!c) return; S.openId = c.dataset.id; S.sheetEditing = false; S.sheetConfirm = false; renderSheet(); });
  $('#sheetBody').addEventListener('click', onSheetClick);
  $('#scriptSheet').addEventListener('close', () => { S.openId = null; });
  $('#claudeSave').addEventListener('click', saveKey);
  $('#claudeForget').addEventListener('click', forgetKey);

  document.addEventListener('sowon:entries', renderAttach);
  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'scripts') sRefresh(); if (e.detail === 'make') renderAttach(); });
  document.addEventListener('sowon:toScript', (e) => {
    const x = e.detail; S.attached.add(x.id); LS.set('sw.attached', [...S.attached]);
    if (!x.ref && !$('#mRough').value.trim()) { $('#mRough').value = x.text; saveForm(); }   // 레퍼런스는 대강 대본 칸을 채우지 않는다
    renderAttach(); SW.switchTab('make'); toast(x.ref ? '대본 탭에 레퍼런스를 붙였어요' : '대본 탭에 메모를 붙였어요');
  });
  document.addEventListener('sowon:topic', async (e) => {   // 스택의 "주제 3개" (Haiku)
    const x = e.detail;
    if (!claudeKey()) { toast('설정 ④에 Claude 열쇠를 넣어 주세요'); return; }
    toast('Haiku가 주제를 뽑는 중…');
    try {
      const res = await askQuick(`재테크 인스타 릴스 채널 "신혼테크"(2030 초보 대상)의 아이디어 메모야. 이 메모로 찍을 수 있는 릴스 주제 3개를 골라. 소구점은 하나씩, 초보 눈높이, 메모에 없는 숫자는 만들지 마.\n후킹 유형은 다음 중에서: ${HOOKS.map((h) => h[0]).join(', ')}.\nJSON 배열만 답해: [{"topic":"주제 한 줄(25자 안팎)","hookType":"후킹 유형"}]\n\n메모:\n${String(x.text).slice(0, 1500)}`);
      const list = (Array.isArray(res) ? res : []).slice(0, 3).map((s) => ({ topic: String(s.topic || ''), hookType: String(s.hookType || '') })).filter((s) => s.topic);
      if (!list.length) { toast('주제가 안 나왔어요. 다시 눌러 주세요'); return; }
      $('#topicList').innerHTML = list.map((s, i) => `<button type="button" data-i="${i}"><em>${esc(s.hookType)}</em>${esc(s.topic)}</button>`).join('');
      $('#topicList').onclick = (ev) => {
        const b = ev.target.closest('[data-i]'); if (!b) return; const s = list[+b.dataset.i];
        $('#mTopic').value = s.topic; const hk = HOOKS.find((h) => h[0] === s.hookType); $('#mHook').value = hk ? hk[0] : '자동';
        S.attached.add(x.id); LS.set('sw.attached', [...S.attached]); saveForm(); renderAttach();
        $('#topicSheet').close(); SW.switchTab('make'); toast('주제를 옮겼어요');
      };
      $('#topicSheet').showModal();
    } catch (err) { toast(errMsg(err)); }
  });
  window.addEventListener('online', sFlush);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sFlush(); });

  renderKeyState(); renderAttach(); renderResult(); renderScripts();
  sFlush(); sRefresh();
}
init();
