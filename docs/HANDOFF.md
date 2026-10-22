# 다음 개발 환경으로 이전

현재 범위는 보정 실패 수정과 공개 소스 게시까지다. 이후 기능 개발은 새 클라우드 작업 공간에서 계속한다. Mac 사용자 카메라·권한·개인 Chrome 프로필이 이전되는 것은 아니다.

## 준비와 재현

Node.js(검증 버전 26.7.0), npm, 테스트용 Chrome 또는 Chromium이 필요하다. API 키·계정·유료 서비스 없이 실행한다.

```sh
git clone https://github.com/OMGimin/gaze-reader-lab.git
cd gaze-reader-lab
npm ci --ignore-scripts
npm run model
npm run build
npm test
npm run test:ui  # 설치된 Chrome 사용
npm start       # http://127.0.0.1:4173, 루프백 전용
```

Chrome이 없는 Linux 클라우드에서는 다음 경로를 사용할 수 있다. 시스템 패키지 설치 권한이나 네트워크가 막히면 우회하지 말고 해당 환경의 승인을 받는다. 이 경로는 아직 Linux에서 실행 검증하지 않았다.

```sh
npx playwright install --with-deps chromium
PLAYWRIGHT_BROWSER=chromium npm run test:ui
```

`vendor/face_landmarker.task`는 저장소에 없다. 다운로드 스크립트가 공식 URL과 고정 SHA-256을 검증한다. 패키지 버전은 lockfile에 고정했고, WASM은 설치된 MediaPipe 패키지에서 빌드 폴더로 복사한다. 모델 준비 전 빌드는 실패한다. 모델 카드·라이선스·출처는 [THIRD_PARTY](../THIRD_PARTY.md)에 있다. 빌드 결과·사용자 보정·영상·개인 로그·자격증명은 이전하지 않는다.

## 현재 결과와 다음 우선순위

Mac Chrome에서 단위 22개, UI 9개 통과. [검증 결과](TEST-RESULTS.md)와 [보정 수정](CALIBRATION-FIX.md)을 먼저 읽는다.

1. 동의한 사용자의 수정 후 실제 보정 성공 여부, 점별 실패 패턴, 명령 구분과 오작동을 확인한다. 카메라는 사용자가 직접 켜고 권한을 선택한다. 영상·원시 눈 특징은 수집하지 않는다.
2. 계속 실패하면 수직 시선 신호의 한계와 자세 의존성을 평가하고 WebGazer 또는 학습된 gaze 추정 대안과 비교한다. 합성 데이터 통과를 실제 정확도 증거로 삼거나 임계값만 낮추지 않는다.
3. 확장을 사용자가 직접 로드한 상태에서 네이버 회차·카메라 창 가림·최소화·절전·탭 이동을 통합 검증한다. 콘텐츠 수집이나 결제 우회는 범위 밖이다.
4. 사용자 결과가 쌓인 다음에만 명령 영역·보정 시간·평활화의 변경을 설계한다. 정확한 화면 좌표 추정과 읽기 의도 판정은 별도 문제다.

웹 호스팅 배포, 추가 계정/OAuth, 자동 카메라 시작은 이 이전 절차에 포함되지 않는다.
