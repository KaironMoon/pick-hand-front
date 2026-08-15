export const emergencyStopResultMessage = (result) => {
  const targeted = Number(result?.targeted || 0);
  const stopped = Number(result?.stopped || 0);
  const failed = Number(result?.failed || 0);
  const workerFailed = Number(result?.worker_failed || 0);
  const discoveryFailed = Boolean(result?.discovery_failed);

  if (discoveryFailed && targeted === 0) {
    return "오토 실행 서버 목록을 확인하지 못했습니다. 다시 시도해 주세요.";
  }
  if (discoveryFailed) {
    return `확인된 ${targeted}개 중 ${stopped}개를 정지했지만, 다른 오토 실행 서버가 있는지 확인하지 못했습니다.`;
  }
  if (workerFailed > 0 && targeted === 0) {
    return `오토 실행 서버 ${workerFailed}대의 상태를 확인하지 못했습니다. 다시 시도해 주세요.`;
  }
  if (workerFailed > 0) {
    return `확인된 ${targeted}개 중 ${stopped}개를 정지했지만, 오토 실행 서버 ${workerFailed}대가 응답하지 않았습니다.`;
  }
  if (targeted === 0) return "현재 실행 중인 글로벌히트·나이스초이스 오토가 없습니다.";
  if (failed === 0) return `실행 중인 오토 ${stopped}개를 모두 정지했습니다.`;
  return `총 ${targeted}개 중 ${stopped}개 정지, ${failed}개 정지 실패했습니다.`;
};
