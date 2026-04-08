
import models from '../../models/index.js';
const CreditTransaction = models['CreditTransaction'];


class ManageCreditsTransaction {
    constructor() {
        return {
            getCreditsTransaction: this.getCreditsTransaction.bind(this),
            deleteOrder: this.deleteOrder.bind(this)
        }
    }

    async deleteOrder({ id }) {
        try {
            if (id) {
                await CreditTransaction.deleteOne({ _id: id });
                return true;
            }
        } catch (error) {
            throw (error);
        }
    }

    async getCreditsTransaction({
        limit = 10,
        sortBy = 'name',
        orderBy = 1,
        skip = 0,
        status,
        startDate,
        endDate,
        name
    }) {
        try {
            const matchStage = {};

            if (status) {
                matchStage.status = status;
            }

            if (startDate && endDate) {
                matchStage.added_on = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };
            }

            // Base pipeline
            const pipeline = [
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                {
                    $unwind: {
                        path: '$user',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ];

            // Filter by user name using regex
            if (name) {
                const cleanedName = name.replace(/[^A-Za-z0-9 ]/g, '');
                pipeline.push({
                    $match: {
                        'user.name': {
                            $regex: `^${cleanedName}`,
                            $options: 'i',
                        },
                    },
                });
            }
            // Sort and paginate
            pipeline.push(
                { $sort: { added_on: -1 } },
                { $skip: skip },
                { $limit: limit }
            );

            // Project desired fields
            pipeline.push({
                $project: {
                    _id: 1,
                    amount: 1,
                    status: 1,
                    payment: 1,
                    bookingId: 1,
                    order: 1,
                    credits: 1,
                    added_on: 1,
                    user: {
                        _id: '$user._id',
                        name: '$user.name',
                        email: '$user.email',
                        phone_number: '$user.phone_number'
                    }
                }
            });

            // Get total count
            const countPipeline = [...pipeline];
            countPipeline.splice(countPipeline.length - 3); // Remove skip, limit, sort
            countPipeline.push({ $count: 'total' });

            const [transactions, totalResult] = await Promise.all([
                CreditTransaction.aggregate(pipeline),
                CreditTransaction.aggregate(countPipeline)
            ]);

            return {
                transactions,
                totalRecords: totalResult[0]?.total || 0
            };

        } catch (error) {
            throw error;
        }
    }



}

export default new ManageCreditsTransaction();