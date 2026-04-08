
import models from '../../models/index.js';
const CreditUsage = models['CreditUsage'];
class ManageCreditUsage {

    constructor() {
        return {
            getCreditUsage: this.getCreditUsage.bind(this)
        }
    }

    async getCreditUsage({ groupBy = 'user', startDate, endDate, limit, skip, name}) {
        try {
            const matchStage = {};
            if (startDate || endDate) {
                matchStage.added_on = {};
                if (startDate) matchStage.added_on.$gte = new Date(startDate);
                if (endDate) matchStage.added_on.$lte = new Date(endDate);
            }

            // Group stage
            const groupStage = {
                $group: {
                    _id: `$${groupBy}`,
                    count: { $sum: 1 },
                    lastUsed: { $max: '$added_on' }
                }
            };

            const basePipeline = [{ $match: matchStage }, groupStage];
            const detailPipeline = [...basePipeline];
            const countPipeline = [...basePipeline];

            if (groupBy === 'user') {
                // Lookup users
                detailPipeline.push(
                    {
                        $lookup: {
                            from: 'users',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: {
                            path: '$user',
                            preserveNullAndEmptyArrays: true
                        }
                    }
                );

                // Add name search match stage
                if (name) {
                    const cleanedName = name.replace(/[^A-Za-z0-9 ]/g, '');
                    detailPipeline.push({
                        $match: {
                            'user.name': {
                                $regex: `^${cleanedName}`,
                                $options: 'i'
                            }
                        }
                    });
                }

                detailPipeline.push(
                    { $sort: { lastUsed: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'creditusages',
                            localField: '_id',
                            foreignField: 'user',
                            as: 'usages'
                        }
                    },
                    {
                        $lookup: {
                            from: 'colivingspaces',
                            localField: 'usages.property',
                            foreignField: '_id',
                            as: 'properties'
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            user: 1,
                            properties: 1,
                            usages: 1,
                            count: 1,
                            lastUsed: 1
                        }
                    }
                );

                // Count pipeline for user group + name search
                const userCountPipeline = [...basePipeline,
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $unwind: {
                        path: '$user',
                        preserveNullAndEmptyArrays: true
                    }
                }
                ];

                if (name) {
                    const cleanedName = name.replace(/[^A-Za-z0-9 ]/g, '');
                    userCountPipeline.push({
                        $match: {
                            'user.name': {
                                $regex: `^${cleanedName}`,
                                $options: 'i'
                            }
                        }
                    });
                }

                userCountPipeline.push({ $count: 'total' });
                const [data, totalResult] = await Promise.all([
                    CreditUsage.aggregate(detailPipeline),
                    CreditUsage.aggregate(userCountPipeline)
                ]);

                return {
                    data,
                    totalCount: totalResult[0]?.total || 0
                };

            } else if (groupBy === 'property') {
                detailPipeline.push(
                    { $sort: { lastUsed: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'colivingspaces',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'property'
                        }
                    },
                    {
                        $lookup: {
                            from: 'creditusages',
                            localField: '_id',
                            foreignField: 'property',
                            as: 'usages'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'usages.user',
                            foreignField: '_id',
                            as: 'users'
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            property: { $arrayElemAt: ['$property', 0] },
                            users: 1,
                            usages: 1,
                            count: 1,
                            lastUsed: 1
                        }
                    }
                );

                countPipeline.push({ $count: 'total' });

            } else if (groupBy === 'type') {
                detailPipeline.push(
                    { $sort: { lastUsed: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'creditusages',
                            localField: '_id',
                            foreignField: 'type',
                            as: 'usages'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'usages.user',
                            foreignField: '_id',
                            as: 'users'
                        }
                    },
                    {
                        $lookup: {
                            from: 'colivingspaces',
                            localField: 'usages.property',
                            foreignField: '_id',
                            as: 'properties'
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            type: '$_id',
                            users: 1,
                            properties: 1,
                            usages: 1,
                            count: 1,
                            lastUsed: 1
                        }
                    }
                );

                countPipeline.push({ $count: 'total' });
            } else {
                throw new Error('Invalid groupBy field');
            }

            const [data, totalCountResult] = await Promise.all([
                CreditUsage.aggregate(detailPipeline),
                CreditUsage.aggregate(countPipeline)
            ]);

            return {
                data,
                totalCount: totalCountResult[0]?.total || 0
            };

        } catch (error) {
            throw error;
        }
    }





}

export default new ManageCreditUsage;