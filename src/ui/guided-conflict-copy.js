export function guidedConflictCopy(info, t) {
  switch (info.type) {
    case 'row':
      return { title: t('guided.rowTitle'), explanation: t('guided.rowCopy') };
    case 'col':
      return { title: t('guided.columnTitle'), explanation: t('guided.columnCopy') };
    case 'region':
      return { title: t('guided.territoryTitle'), explanation: t('guided.territoryCopy') };
    case 'touch':
      return { title: t('guided.touchTitle'), explanation: t('guided.touchCopy') };
    case 'deadend':
      return info.excluded
        ? { title: t('guided.exclusionTitle'), explanation: t('guided.exclusionCopy') }
        : { title: t('guided.deadendTitle'), explanation: t('guided.deadendCopy') };
  }
}
