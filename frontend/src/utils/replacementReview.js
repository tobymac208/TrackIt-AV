import { isEosPast, isEosSoon, isWarrantyPast } from '../components/ImportanceBadge';

export const REPLACEMENT_LEAD_TIME = '3 months';

export const REPLACEMENT_CRITERIA = {
  critical:
    'Critical — EOL equipment with security risk. Prioritize replacement and include cost estimate for business review.',
  high: 'High — End of support (EOL without security vulnerability), out of warranty, or approaching EOS. Plan replacement with ~3 month lead time.',
  medium: 'Medium — Monitor during annual review; replace when functionality or room impact warrants.',
  low: 'Low — Monitor; replacement driven by functionality if a room stops working.',
};

export function isOutOfWarranty(item) {
  return isWarrantyPast(item.end_of_warranty_date);
}

export function getReplacementStatus(item) {
  if (isEosPast(item.end_of_support_date)) {
    return { label: 'Past EOS / EOL', sortOrder: 1, rowClass: 'eos-past' };
  }
  if (isOutOfWarranty(item) && (item.importance_level === 'critical' || item.importance_level === 'high')) {
    return { label: 'Out of warranty', sortOrder: 2, rowClass: 'eos-past' };
  }
  if (isEosSoon(item.end_of_support_date)) {
    return { label: 'EOS within 90 days', sortOrder: 3, rowClass: 'eos-soon' };
  }
  if (item.upgrade_recommendations?.trim()) {
    return { label: 'Recommendation on file', sortOrder: 4, rowClass: '' };
  }
  if (!item.end_of_support_date) {
    return { label: 'EOS date missing', sortOrder: 5, rowClass: '' };
  }
  return { label: 'Monitor', sortOrder: 6, rowClass: '' };
}

export function isAnnualReviewItem(item) {
  return item.importance_level === 'critical' || item.importance_level === 'high';
}

export function isPriorityReplacement(item) {
  if (!isAnnualReviewItem(item)) return false;
  return getReplacementStatus(item).sortOrder < 6;
}

export function getRecommendationText(item) {
  if (item.upgrade_recommendations?.trim()) {
    return item.upgrade_recommendations.trim();
  }
  if (isEosPast(item.end_of_support_date)) {
    if (item.importance_level === 'critical') {
      return 'Replace — EOL equipment with security risk';
    }
    return 'Replace — End of support reached';
  }
  if (isOutOfWarranty(item) && (item.importance_level === 'critical' || item.importance_level === 'high')) {
    return 'Replace — Out of warranty on critical/high hardware';
  }
  if (isEosSoon(item.end_of_support_date)) {
    return 'Plan replacement — End of support approaching';
  }
  if (!item.end_of_support_date) {
    return 'Add EOS date and replacement recommendation';
  }
  return 'Include in annual review — no immediate EOS action';
}

export function buildReplacementReview(hardware) {
  const annualItems = hardware
    .filter(isAnnualReviewItem)
    .map((item) => ({
      ...item,
      replacementStatus: getReplacementStatus(item),
      recommendation: getRecommendationText(item),
    }))
    .sort((a, b) => {
      const statusDiff = a.replacementStatus.sortOrder - b.replacementStatus.sortOrder;
      if (statusDiff !== 0) return statusDiff;
      const importanceOrder = { critical: 0, high: 1 };
      const impDiff =
        (importanceOrder[a.importance_level] ?? 9) - (importanceOrder[b.importance_level] ?? 9);
      if (impDiff !== 0) return impDiff;
      return `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`);
    });

  const priorityItems = annualItems.filter((item) => item.replacementStatus.sortOrder < 6);
  const totalEstimatedCost = annualItems.reduce(
    (sum, item) => sum + (item.estimated_replacement_cost || 0),
    0
  );
  const priorityEstimatedCost = priorityItems.reduce(
    (sum, item) => sum + (item.estimated_replacement_cost || 0),
    0
  );

  return {
    annualItems,
    priorityItems,
    totalEstimatedCost,
    priorityEstimatedCost,
    criticalCount: annualItems.filter((i) => i.importance_level === 'critical').length,
    highCount: annualItems.filter((i) => i.importance_level === 'high').length,
    outOfWarrantyCount: annualItems.filter(isOutOfWarranty).length,
  };
}
