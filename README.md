# Gaze Reader Lab

Mac Chrome에서 전면 카메라의 눈·얼굴 특징을 개인별로 보정하고, 의도적 응시로 웹툰을 한 구간씩 넘기는 **로컬 실험 시제품**입니다. 실제 사람의 시선 정확도와 실제 네이버 페이지에서의 확장 동작은 아직 검증하지 않았습니다.

## 바로 실행

Node.js와 Chrome이 필요합니다. 저장소에는 모델·빌드 결과·카메라 데이터가 포함되지 않습니다.

```sh
git clone https://github.com/OMGimin/gaze-reader-lab.git
cd gaze-reader-lab
npm ci --ignore-scripts
npm run model     # 공식 출처에서 모델 다운로드, SHA-256 검증
npm run build
npm start
```

[로컬 읽기 페이지](http://127.0.0.1:4173)를 Chrome에서 여세요. 서버가 종료됐다면 프로젝트 폴더에서 `npm start`로 다시 시작합니다. 종료는 터미널에서 `Ctrl+C`입니다. 같은 포트에 이 프로젝트 서버가 이미 실행 중이면 페이지를 바로 열면 됩니다.

1. **모의 체험 시작 → 모의 입력 켜기 → 시작 / 재개**를 누릅니다.
2. 마우스를 화면 중앙에 350ms, 아래 초록 영역에 900ms 머무르면 한 구간 내려갑니다.
3. 아래에 계속 두어도 반복 이동하지 않습니다. 중앙에 돌아온 뒤 다시 아래를 봅니다.
4. 위 영역은 이전 구간, **되돌리기**는 마지막 이동 전 위치입니다. **Esc**, 정지 버튼, 수동 스크롤, 창 전환은 중단합니다.

모의 입력은 UI 검증용입니다. 마우스가 시선을 대신하므로 카메라 정확도에 관한 증거가 아닙니다.

## 사용자가 직접 하는 카메라 확인

카메라는 자동으로 켜지지 않습니다. 이 작업 중 실제 카메라 호출이나 권한 승인은 하지 않았습니다.

1. 먼저 모의 입력을 끕니다.
2. **카메라 직접 시작 → 카메라 켜기**를 누릅니다. Chrome과 macOS의 카메라 권한 창이 나오면 사용자가 직접 선택합니다. 마이크 권한은 필요 없습니다.
3. 얼굴을 한 명만 화면에 두고 정면 조명을 확보합니다. 노트북과 머리를 고정하고 **시선 보정**을 누릅니다.
4. 9개 점을 눈으로 따라갑니다. 각 점에서 1.2초 동안 시선을 옮긴 뒤 새로운 영상 표본 24개를 모읍니다. 이어서 학습에 사용하지 않은 5개 점으로 정확도와 위/중앙/아래 영역 구분을 확인합니다. 정상 입력 속도에서 약 40초가 걸립니다. 입력이 끊기면 **이 점 다시 측정**으로 해당 점만 재시도합니다.
5. 통과했을 때만 시작 버튼이 활성화됩니다. 실패하면 펼쳐지는 **보정 진단**에서 평균/최대 오차, 위·중앙·아래 영역 일치율과 점별 표본을 확인합니다. 조명·안경 반사·머리 위치를 조정하고 다시 보정합니다. 수치를 낮춰 강제로 통과시키는 방식은 제공하지 않습니다.
6. **시작 / 재개**를 눌러 중앙→아래를 시험합니다. 위치나 크기·배율을 바꾸면 다시 보정합니다.
7. 끝나면 **카메라 끄기** 또는 카메라 닫기 버튼을 누릅니다.

권한 거절 시 정상 정지합니다. 권한을 다시 허용할지는 사용자가 Chrome 사이트 설정과 macOS 시스템 설정에서 결정합니다. 접근성 권한은 사용하지 않습니다.

## Chrome 확장 설치 — 사용자 수동 단계

설치는 자동으로 수행하지 않았습니다. unpacked 확장의 권한을 검토하고 사용자가 직접 설치해야 합니다.

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 사용자가 **개발자 모드**를 켜고 **압축해제된 확장 프로그램을 로드합니다**를 선택합니다.
3. 다음 폴더를 선택합니다.

   `<프로젝트 폴더>/dist/extension`

4. 먼저 `http://127.0.0.1:4173`에서 확장 아이콘을 누릅니다. 이때 페이지의 “모의 체험 시작”은 함께 누르지 마세요. 페이지 데모와 확장 도우미는 각각 별개입니다.
5. 별도 **Gaze Camera** 창이 열립니다. 자동 카메라 시작은 없습니다. 창을 화면 옆에 놓고 **카메라 켜기**와 권한 선택을 직접 수행합니다.
6. 읽기 창으로 돌아와 보정한 후 시작합니다. 카메라 창은 보이게 유지합니다. 최소화·가림·절전으로 입력이 늦어지면 자동 정지합니다.
7. 다음으로 본인이 정상 접근할 수 있는 `https://comic.naver.com/webtoon/detail?...` 회차 페이지에서 같은 절차를 시험합니다. 다른 페이지에서는 확장 아이콘에 “범위 밖”이 표시됩니다.
8. 종료 시 도우미 `×`를 누르면 연결된 카메라가 꺼집니다. 카메라 창도 닫을 수 있습니다. 확장 제거는 Chrome 확장 관리 화면에서 직접 수행합니다.

요청 권한은 `activeTab`과 `scripting`입니다. 사용자가 확장 아이콘으로 선택한 탭만 대상으로 삼습니다. 상시 사이트 접근 권한, 탭 전체 열람, 콘텐츠 수집, 계정·쿠키 접근, 결제 우회는 구현하지 않았습니다. 모바일 네이버·목록 페이지·중첩 스크롤 컨테이너는 범위 밖입니다.

기존 설치를 업데이트했다면 먼저 `npm run build`를 실행하고, `chrome://extensions`의 해당 확장 **새로고침**을 누른 뒤 읽기 페이지도 새로고침하고 확장 아이콘을 다시 누르세요. 카메라 창 위치는 보정 전에 정하고, 보정 중에는 읽기 창을 활성 상태로 유지하세요.

## 재설치·빌드·테스트

새 환경에서는 Node.js와 Mac Chrome이 필요합니다. 검증 환경은 Node 26.7.0, macOS 26.6.2 arm64, Chrome 155.0.8059.85입니다.

```sh
npm ci --ignore-scripts
npm run model     # 공식 모델 다운로드; SHA-256 확인
npm run build
npm test
npm run test:ui   # 설치된 Mac Chrome, 격리된 임시 테스트 프로필
npm start
```

패키지·모델 다운로드 시에만 인터넷이 필요합니다. 실행 중에는 모델과 WASM을 로컬 파일에서 읽습니다. `npm run test:ui`는 실제 카메라 함수를 오류를 반환하는 모의 함수로 교체합니다. 기존 Chrome 프로필·로그인·확장 설치를 수정하지 않습니다.

## 결과와 한계

- [짧은 기획서·기술 선택](docs/PLAN.md)
- [검증 결과·미검증 항목](docs/TEST-RESULTS.md)
- [실제 사용자 확인 절차](docs/HUMAN-CHECK.md)
- [보정 실패 수정과 재검증](docs/CALIBRATION-FIX.md)
- [다음 환경으로 이전하기](docs/HANDOFF.md)
- [라이선스·모델 출처](THIRD_PARTY.md)
- [데스크톱 화면](docs/desktop.png), [제어 패널](docs/reader-controls.png)
- Playwright 상세 보고서: `playwright-report/index.html`

손을 완전히 쓰지 못하는 사용자를 위한 검증된 접근성 도구는 아닙니다. 첫 시작·보정·재개에 버튼 조작이 필요합니다. 화면 응시 좌표는 경험적 보정 추정값이며, 조명·안경·눈의 형태·자세·외부 모니터·웹캠 위치에 따라 작동하지 않을 수 있습니다. 실제 사용자 평가 전에는 읽기 정확도나 오작동률을 주장할 수 없습니다.

원본 코드는 [MIT License](LICENSE)입니다. 제3자 구성요소는 각자의 라이선스를 따릅니다. 이 저장소 공개는 웹 서비스 배포나 카메라 데이터 공개를 포함하지 않습니다.

## iPhone 14 Pro native work (separate experimental target)

The `feature/iphone14pro-reader` branch adds an independent native ARKit + WKWebView app under [`ios/`](ios/README.md). It is not a Chrome-extension installation and does not control the Naver native app. Xcode build, signing, installation and physical-device verification are pending. See [`ios/VALIDATION.md`](ios/VALIDATION.md) for exact tested and untested boundaries. iPad support is postponed.
