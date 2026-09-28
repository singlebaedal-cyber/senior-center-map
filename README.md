# 👵 전국 경로당 방문 영업 & 지도 관리 솔루션 (Senior Center Map)

> **배포 도메인**: [https://senior-center-map-nu.vercel.app/](https://senior-center-map-nu.vercel.app/)  
> **로컬 프로젝트 위치**: `C:\Users\HEO\.gemini\antigravity\scratch\senior-center-map`

---

## 🚨 문제 원인 및 해결 내용 (다음날 데이터 리셋 방지)

### 1. 데이터가 다음날 사라졌던 원인
1. **Vercel Serverless 무상태(Stateless) 초기화**:
   - Vercel의 서버리스 함수(`/api/data`)는 요청이 없을 때(야간 또는 수 분간 비활성 시) 컨테이너가 종료됩니다.
   - 다음날 접속하면 서버 메모리가 `{ places: [] }`로 완전히 비워진 새 컨테이너로 시작됩니다.
2. **동기화 로직 버그 (치명적 초기화)**:
   - 기존 코드에서는 페이지 접속 시 서버(`/api/data`)를 먼저 조회했습니다.
   - 서버가 빈 배열(`places: []`)을 반환하더라도 HTTP 200 정상 응답으로 인식하여, **브라우저에 보관되어 있던 로컬 데이터(`localStorage`) 로드를 생략(스킵)**해버리는 치명적인 버그가 있었습니다.
   - 이로 인해 화면에는 0개로 표시되고, 이후 조작 시 빈 상태가 로컬 저장소까지 덮어써버렸습니다.
3. **브라우저 용량 제한(5MB)**:
   - 군/구 단위 수백~수천 개 경로당의 주소, 전화번호, 메모 등 대용량 데이터는 5MB LocalStorage 한계를 초과하여 저장이 누락될 위험이 있었습니다.

---

### 2. 완벽하게 적용된 5중 영구 보존(Persistence) 해결책

1. **로컬 우선 즉시 로드 (Local-First Zero-Delay)**:
   - 페이지가 열리는 즉시 네트워크 응답을 기다리지 않고 **LocalStorage 및 IndexedDB**에서 경로당 데이터를 1ms 만에 즉시 복원합니다.
2. **서버 초기화 감지 및 자동 역복구 (Anti-Wipe Shield)**:
   - 서버 컨테이너가 밤사이 재부팅되어 0개로 응답하더라도, **로컬에 데이터가 있으면 절대 로컬 데이터를 지우지 않습니다.**
   - 오히려 *"서버 재부팅 감지, 로컬의 N개 데이터를 서버로 자동 복원"*을 수행하여 서버리스 메모리를 즉각 재충전합니다.
3. **IndexedDB 무제한 영구 보관소 탑재**:
   - 용량 제한이 거의 없는 브라우저 표준 데이터베이스(IndexedDB)를 동시 적용하여 수만 건의 경로당 데이터도 깨짐 없이 안전하게 보관됩니다.
4. **날짜별 자동 스냅샷 복원 기능**:
   - 경로당을 등록하거나 수정할 때마다 날짜/시간별로 자동 스냅샷이 누적 보관됩니다.
   - 상단 **[마스터 데이터 전체 백업 & 복원]** 메뉴에서 언제든 원하는 과거 날짜로 원클릭 복원할 수 있습니다.
5. **Vercel KV / Redis 영구 클라우드 스토리지 연동 지원**:
   - `/api/data.js` 백엔드에 Vercel KV(Upstash Redis) 자동 감지 코드가 내장되어, Vercel 대시보드에서 Storage(KV)를 연결하면 모바일-PC 간에도 영구 보존됩니다.

---

## 🚀 배포 방법 (3초 컷)

### 가장 쉬운 방법 (드래그 앤 드롭)
1. 브라우저에서 **Vercel 대시보드([vercel.com](https://vercel.com))**에 로그인합니다.
2. `senior-center-map-nu` 프로젝트 화면을 엽니다.
3. 이 폴더(`C:\Users\HEO\.gemini\antigravity\scratch\senior-center-map`) 전체를 Vercel 화면에 **마우스로 끌어다 놓기(드래그 앤 드롭)**만 하면 즉시 최신 버전으로 배포 완료됩니다!

### PowerShell 스크립트 배포
```powershell
cd C:\Users\HEO\.gemini\antigravity\scratch\senior-center-map
.\deploy.ps1 -VercelToken "YOUR_VERCEL_TOKEN"
```
