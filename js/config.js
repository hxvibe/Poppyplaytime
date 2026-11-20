// 그랩팩 튜닝 값 — 여기 숫자만 바꿔서 손맛을 조절할 수 있습니다.
export const CONFIG = {
  // 크기
  packScale: 0.8,          // 런처(총) 크기 배율
  handScale: 0.17,         // 손 모델 크기 (원본은 약 1m 라서 줄여서 사용)

  // 컨트롤러 → 런처 정렬
  // 런처 방향은 컨트롤러의 조준(레이) 방향, 위치는 그립 위치를 따릅니다.
  gripPitchDeg: 0,         // 런처를 조준 방향 대비 위(-)/아래(+)로 더 기울이고 싶을 때
  handleOffset: [0, -0.07, -0.035], // 방아쇠 관절 기준 손잡이 위치 (팩 원본 좌표, m)

  // 손 발사
  maxRange: 16,            // 최대 사거리 (m)
  flySpeed: 30,            // 날아가는 속도 (m/s)
  retractSpeed: 24,        // 돌아오는 속도 (m/s)
  minHoldTime: 0.12,       // 짧게 눌렀을 때도 표면에 붙어있는 최소 시간
  tetherSlack: 4,          // 붙어있는 상태에서 이만큼 더 멀어지면 강제로 회수
  recoilScale: 0.35,       // 팩 발사 애니메이션의 반동을 VR용으로 줄이는 비율
  throwSpeed: 9,           // 들고 있는 물건을 던지는 속도

  // 이동
  moveSpeed: 2.2,
  snapTurnDeg: 30,
  reelSpeed: 5,            // 그립으로 몸을 끌어당길 때 속도
  reelStopDistance: 1.0,

  // 오른손 색 (파란 텍스처의 채널을 바꿔 빨간 손으로 만듦)
  rightHandTint: [1.0, 0.55, 0.55], // (B, G, R) → (R, G, B) 스왑 후 곱하는 값
  mirrorRightHand: true,   // 원본이 왼손 모델이라 오른손은 좌우 반전
};

// 손 애니메이션 (project_playtime__rigged_grab_pack_hand)
export const HAND_CLIPS = {
  default: 'handL_pose_default_Anim',
  straight: 'handL_pose_straight_Anim',
  fired: 'A_Hand_Fired',
  retract: 'A_Hand_Retract',
  // grab 계열 — 오브젝트의 userData.grab 값과 이름이 같습니다
  sphere: 'hand_grab_sphere_anim',
  cornerbox: 'handL_grab_cornerbox_Anim',
  fingertips: 'handL_grab_fingertips_anim',
  half: 'handL_grab_half_anim',
  handle: 'handL_grab_handle_Anim',
  handle_half: 'handL_grab_handle_half_anim',
  straightedge: 'handL_grab_straightedge_Anim',
  smallstraightedge: 'handL_grab_smallstraightedge_Anim',
};

// 팩 애니메이션 (poppy_playtime_grab_pack_2.0)
// 원본 클립은 양쪽 런처를 함께 움직이므로 코드에서 _L_ / _R_ 트랙만 골라 씁니다.
export const PACK_CLIPS = {
  shootOut: { L: 'LeftHandShootSlot', R: 'RightHandShootSlot', fallback: 'A_FirstPersonPlayer_GrabpackShootOut' },
  shootIn: { L: 'LeftHandShootSlot.001', R: 'RightHandShootSlot.001', fallback: 'A_FirstPersonPlayer_GrabpackShootIn' },
  shootFlare: { R: 'RightHandShootSlot.002', fallback: 'A_FirstPersonPlayer_GrabpackShootFlare' },
  flashlightOn: 'A_FirstPersonPlayer_FlashlightOn',
  flashlightOff: 'A_FirstPersonPlayer_FlashlightOff',
};
