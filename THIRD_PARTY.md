# Third-party software and assets

확인: 2026-10-22. 원본 앱 코드는 이 작업을 위해 작성되었고, 읽기 장면은 CSS 도형과 자체 문장으로 제작했다. 네이버 웹툰 이미지·텍스트는 포함하지 않는다.

- `@mediapipe/tasks-vision` 1.1.1: Google, Apache-2.0. [Repository / license](https://github.com/google-ai-edge/mediapipe/blob/v1.1.1/LICENSE). 원문 `vendor/MEDIAPIPE-LICENSE.txt`; 패키지 README의 개인정보 안내도 빌드에 포함한다. 모델과 WASM은 원격 CDN 없이 번들 안에서 로드한다.
- Face Landmarker bundle float16 version 1: [공식 모델](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task), 3,758,596 bytes. SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. 다운로드 스크립트가 해시를 검증한다. [모델 안내 및 구성요소별 카드](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker). FaceDetector(BlazeFace), Face Mesh V2, Blendshape V2의 공식 모델 카드 각 1쪽에서 Apache License 2.0을 확인했다. 모델은 얼굴 표면 랜드마크용이며 화면 시선 추정의 검증된 정확도를 제공하지 않는다.
- esbuild 0.25.12: MIT, 빌드 도구. [License](https://github.com/evanw/esbuild/blob/v0.25.12/LICENSE.md).
- `@playwright/test` 1.56.1: Apache-2.0, 개발 테스트 도구. [License](https://github.com/microsoft/playwright/blob/v1.56.1/LICENSE). `vendor/LICENSE-APACHE-2.0.txt`는 설치된 Playwright 패키지의 라이선스 원문 사본이다.

`package-lock.json`은 패키지 버전 및 무결성 정보를 고정한다. 모델 카드나 문서의 사이트 저작권 표기와 모델 자체의 라이선스를 구분했다. 공개 저장소에는 모델 바이너리, WASM, node_modules, 생성된 번들을 넣지 않는다. `npm ci --ignore-scripts`와 `npm run model`로 공식 패키지·모델을 준비한다. 모델이 Apache-2.0으로 안내됨을 확인했지만, 바이너리 재배포 대신 공식 다운로드와 고정 해시 검증을 사용한다. 로컬 빌드에는 MediaPipe 라이선스와 개인정보 안내를 함께 복사한다. 원본 코드의 MIT 라이선스가 제3자 구성요소의 라이선스를 대체하지 않는다.
