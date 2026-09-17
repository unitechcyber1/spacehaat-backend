/** SpaceHaat billing — supported verticals for invoicing. */
export const SPACEHAAT_BILLING_SPACE_TYPES = [
    'Coworking Space',
    'Office Space',
    'PG',
    'Coliving Space',
    'Virtual Office',
];

export const SPACEHAAT_BILLING_SPACE_TYPE_SET = new Set(SPACEHAAT_BILLING_SPACE_TYPES);

export function isSpacehaatBillingSpaceType(spaceType) {
    return SPACEHAAT_BILLING_SPACE_TYPE_SET.has(String(spaceType || '').trim());
}
