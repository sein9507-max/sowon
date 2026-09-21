# 소원저장소

생각나는 대로 말하면 글자로 쌓이는 아이디어 음성 일기. 휴대폰 홈 화면에 앱처럼 설치해서 쓴다.

- 말한 내용은 **쓰는 사람 본인의 GitHub 저장소**에만 저장된다. 이 사이트는 저장 공간이 없고, 서버도 없다.
- GitHub 열쇠(fine-grained token)는 **그 휴대폰 브라우저 안(localStorage)에만** 보관되며, GitHub 외의 어디로도 보내지 않는다.
- 인터넷이 끊기면 휴대폰에 담아뒀다가 연결되면 올린다.

## 쓰는 법

1. 휴대폰 Safari(또는 Chrome)로 이 사이트를 연다.
2. 설정 ⚙ → **① 저장소 열쇠**에서 안내대로 GitHub 열쇠를 만들어 붙여넣는다.
3. 설정 → **② 로고 변경**에서 아이콘을 고른다.
4. 공유 버튼 → **홈 화면에 추가**.
5. 홈 화면 아이콘으로 연 뒤 열쇠를 한 번 더 넣는다. (Safari와 홈 화면 앱은 저장 공간이 따로다)

## 만든 것

순수 HTML·CSS·JS. 빌드 도구 없음. 외부 요청은 `api.github.com` 하나뿐이다(CSP로 제한).

글꼴: [Galmuri](https://github.com/quiple/galmuri) (SIL Open Font License 1.1, `fonts/LICENSE-Galmuri.txt`)
