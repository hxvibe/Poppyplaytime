# Poppyplaytime — GrabPack VR

메타 퀘스트 2 브라우저에서 바로 실행되는 WebXR(three.js) 그랩팩 프로토타입입니다.
설치 없이 GitHub Pages 주소를 퀘스트 브라우저로 열고 **ENTER VR**을 누르면 됩니다.

## 조작

| 입력 | 동작 |
|---|---|
| 트리거 (왼/오) | 파란 손 / 빨간 손 발사. 누르고 있으면 붙잡고 있고, 떼면 회수 |
| 짧게 탭 | 맞은 물건을 바로 끌어옴 |
| 물건을 든 채 트리거 | 던지기 |
| 그립 | 손이 고정된 곳(벽·파이프·작업대)으로 몸 끌어당기기 / 든 물건 내려놓기 |
| A (오른손) | 손전등 켜기/끄기 |
| B (오른손) | 플레어 발사 |
| 왼쪽 스틱 / 오른쪽 스틱 | 이동 / 30° 스냅 회전 |

PC 미리보기: 마우스 좌/우 클릭(또는 Q/E) = 손 발사, WASD 이동, F 손전등, G 플레어, Space 끌어당기기, Z/X 내려놓기.

## 사용한 애니메이션

**손 (`models/grabpack_hand.glb`)** — 오른손은 같은 모델을 좌우 반전하고 색만 빨갛게 바꿔서 사용
- `handL_pose_default` — 런처에 장착된 상태
- `A_Hand_Fired` — 발사 순간 / `A_Hand_Retract` — 회수
- `handL_pose_straight` — 일반 벽·바닥·스캐너에 닿았을 때
- grab 계열 8종 — 오브젝트마다 지정 (`userData.grab`)
  - `hand_grab_sphere` 공 · `grab_cornerbox` 장난감 블록 · `grab_fingertips` 작은 부품
  - `grab_handle` 레버·배터리 · `grab_handle_half` 서랍 손잡이 · `grab_half` 천장 파이프
  - `grab_straightedge` 작업대·긴 판자 · `grab_smallstraightedge` 벽 선반·테이프

**팩 (`models/grabpack.glb`)** — 원본 클립이 양쪽 런처를 함께 움직이므로 `_L_`/`_R_` 트랙만 골라서 각 손에 적용, 반동은 VR용으로 35%로 줄임
- 발사: `LeftHandShootSlot` / `RightHandShootSlot` (= `GrabpackShootOut`)
- 회수: `LeftHandShootSlot.001` / `RightHandShootSlot.001` (= `GrabpackShootIn`)
- 플레어: `RightHandShootSlot.002` (= `GrabpackShootFlare`)
- 손전등: `FlashlightOn` / `FlashlightOff` (뚜껑은 유지, 런처 흔들림은 1회)

## 테스트 룸

어두운 방에서 시작합니다.
1. 왼쪽 벽 **레버**를 당겨 조명 켜기
2. 앞벽 **파란 스캐너는 파란 손**, **빨간 스캐너는 빨간 손**으로 찍으면 문이 열림
3. 작업대 위 **배터리**를 끌어와서 안쪽 방 **소켓**에 꽂으면 POWER ON

## 구조

```
index.html        로딩 화면 + VR 버튼
js/config.js      크기·속도·애니메이션 이름 등 튜닝 값
js/grabpack.js    런처/손 상태 머신 (docked → flying → attached → retracting)
js/world.js       테스트 룸, 간단한 물리, 스캐너/레버/서랍/소켓
js/input.js       퀘스트 컨트롤러 + PC 입력
js/cable.js       손과 런처를 잇는 케이블
js/audio.js       WebAudio로 합성한 효과음
lib/three/        three.js r187 (MIT)
models/           GLB 모델
```

새 물건을 추가할 땐 메쉬의 `userData.grab`에 포즈 이름(`sphere`, `handle` 등)을 넣고 `world.rayTargets`에 넣으면 됩니다.

## 크레딧

`models/` 폴더의 GLB 모델은 제3자가 제작한 팬 모델(Sketchfab)입니다. 저장소가 공개이므로 각 모델의 라이선스와 표기 조건을 확인해 주세요.
Poppy Playtime 및 관련 디자인의 권리는 Mob Entertainment에 있으며, 이 저장소는 비공식 팬 프로젝트입니다.
