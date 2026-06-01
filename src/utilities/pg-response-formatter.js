/**
 * Maps a populated PG document to the frontend listing/detail shape.
 */

function formatDate(value) {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
}

function parseMaintenanceAmount(value) {
    if (value == null || value === '') return null;
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function rentRangeFromDoc(doc) {
    const rooms = Array.isArray(doc.pgRooms) ? doc.pgRooms : [];
    const rents = rooms
        .map((r) => Number(r.monthlyRent))
        .filter((n) => Number.isFinite(n) && n > 0);

    let min = doc.minMonthlyRent;
    let max = doc.maxMonthlyRent;
    if (rents.length) {
        const rMin = Math.min(...rents);
        const rMax = Math.max(...rents);
        min = min != null ? Math.min(min, rMin) : rMin;
        max = max != null ? Math.max(max, rMax) : rMax;
    }
    if (min == null && max == null) return { min: null, max: null };
    return { min: min ?? max, max: max ?? min };
}

function coordinatesFromDoc(doc) {
    const coords = doc?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return undefined;
    const a = Number(coords[0]);
    const b = Number(coords[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    // GeoJSON: [lng, lat] after model normalization
    const latFirstLikely = Math.abs(a) <= 45 && Math.abs(b) > 45;
    const lat = latFirstLikely ? a : b;
    const lng = latFirstLikely ? b : a;
    return { lat, lng };
}

function imageUrl(entry) {
    const img = entry?.image;
    if (!img) return '';
    if (typeof img === 'string') return img.trim();
    return String(img.s3_link || '').trim();
}

export function toPgSlug(doc) {
    if (doc?.slug) {
        return String(doc.slug).toLowerCase().trim();
    }
    if (doc?.name) {
        return String(doc.name)
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    return '';
}

export function formatPgForFrontend(doc) {
    if (!doc) return null;

    const rentRange = rentRangeFromDoc(doc);
    const coords = coordinatesFromDoc(doc);

    const images = (Array.isArray(doc.images) ? doc.images : [])
        .map((row, idx) => ({
            image: imageUrl(row),
            order: row?.order != null ? Number(row.order) : idx,
        }))
        .filter((row) => row.image)
        .sort((a, b) => a.order - b.order);

    const payload = {
        slug: toPgSlug(doc),
        pg_id: doc.pg_id || '',
        name: doc.name || '',
        city: doc.city || '',
        locality: doc.locality || '',
        address: doc.address || '',
        street: doc.street || '',
        rating: doc.rating != null ? Number(doc.rating) : 0,
        reviews: (Array.isArray(doc.ratings) ? doc.ratings : []).map((r) => ({
            status: r.currentStatus || r.type || '',
            rating: r.rating != null ? Number(r.rating) : 0,
            feedback: r.feedbacks || '',
            date: formatDate(r.createdAt) || '',
        })),
        noticePeriod: {
            required: !!doc.noticePeriod,
            days: doc.noticePeriodDuration != null ? Number(doc.noticePeriodDuration) : 0,
        },
        maintenanceCharge: {
            applicable: !!doc.maintenanceAmount,
            amount: doc.maintenanceAmount
                ? parseMaintenanceAmount(doc.maintenanceAmountValue)
                : null,
        },
        food: {
            included: !!doc.foodIncluded,
            meals: Array.isArray(doc.includedMeals) ? doc.includedMeals : [],
        },
        rules: Array.isArray(doc.pgHostelRule) ? doc.pgHostelRule : [],
        laundry: {
            available: !!doc.isLaundryService,
            schedule:
                doc.laundryService?.days ||
                doc.laundryService?.title ||
                '',
        },
        roomCleaning: !!doc.roomCleaning,
        water: !!doc.waterFacility,
        parking: {
            available: !!doc.parking,
            vehicleType: doc.vehicleType || '',
        },
        commonAmenities: Array.isArray(doc.availableAmenities)
            ? doc.availableAmenities
            : [],
        roomAmenities: Array.isArray(doc.roomAmenities) ? doc.roomAmenities : [],
        gateClosing: !!doc.gateClosing,
        preferredGuests: doc.preferredGuest || '',
        type: doc.availableFor || '',
        postedBy: doc.postBy || '',
        contactSchedule: doc.selectTimeSchedule || '',
        description: doc.description || '',
        verified: !!doc.verified,
        status: doc.status || '',
        priority: doc.priority
            ? {
                  overall: doc.priority.overall,
                  location: doc.priority.location,
                  micro_location: doc.priority.micro_location,
              }
            : undefined,
        rooms: (Array.isArray(doc.pgRooms) ? doc.pgRooms : []).map((r) => ({
            type: r.roomType || '',
            rent: r.monthlyRent != null ? Number(r.monthlyRent) : null,
            deposit: r.expectedDeposit != null ? Number(r.expectedDeposit) : null,
        })),
        rentRange: {
            min: rentRange.min,
            max: rentRange.max,
        },
        images,
    };

    if (coords) payload.coordinates = coords;

    const availableFrom = formatDate(doc.availableFrom);
    if (availableFrom) payload.availableFrom = availableFrom;

    return payload;
}
