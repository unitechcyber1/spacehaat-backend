/** Default priority slots on PG (mirrors WorkSpace). */
export const DEFAULT_PG_PRIORITY = {
    overall: {
        is_active: false,
        order: 1000,
    },
    location: {
        city: undefined,
        is_active: false,
        order: 1000,
    },
    micro_location: {
        name: undefined,
        city: undefined,
        is_active: false,
        order: 1000,
    },
};

export const DEFAULT_PG_VIRTUAL_PRIORITY = {
    location: {
        city: undefined,
        is_active: false,
        order: 1000,
    },
};

/**
 * @param {'overall'|'location'|'micro_location'} type
 * @param {boolean} [virtualPriority]
 */
export function createDynamicPriorityType(type, virtualPriority = false) {
    const base = virtualPriority ? 'virtual_priority' : 'priority';
    switch (type) {
        case 'location':
            return `${base}.location`;
        case 'micro_location':
            return virtualPriority ? `${base}.location` : `${base}.micro_location`;
        default:
            return `${base}.overall`;
    }
}

/** Fields cleared when PG is rejected (same idea as WorkSpace). */
export function priorityResetOnRejectFields() {
    return {
        'priority.overall.is_active': false,
        'priority.overall.order': 1000,
        'priority.location.is_active': false,
        'priority.location.order': 1000,
        'priority.micro_location.is_active': false,
        'priority.micro_location.order': 1000,
        'virtual_priority.location.is_active': false,
        'virtual_priority.location.order': 1000,
    };
}

/**
 * City filter when shifting orders after removing a PG from a priority list.
 */
export function pgPriorityCityCondition(data) {
    if (!data?.city) return {};
    return { 'locationIds.city': data.city };
}
