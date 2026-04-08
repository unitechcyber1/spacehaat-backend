import models from "../../models/index.js";
import manageWorkSpaceService from "./manage-work-space.js";
import crypto from "crypto";
import FileUtility from "../../utilities/file.js";
import { findCountryByCoordinate } from "country-locator";
import aws from "../../utilities/aws.js";
import app from "../../config/app.js";
import axios from "axios";
import { web_query_sheet } from "../../utilities/queryToExcelSheet.js";
import { getCountry } from "country-currency-map";
import FileUpload from '../../controllers/common/fileUpload.js'
// import { sheets } from '../../utilities/uploadToExcelSheet.js'
const Flats = models['Flats'];
const Image = models['Image'];
const User = models['User'];
const MicroLocation = models['MicroLocation'];
const Country = models['Country'];



const spreadsheetId = "1uwiOeDkq4Bq596adnXC5bfE7SWFyscrLNcQOv7vVdqc";
const range = "Flat/Apartment!A2:C2"; // Update row 2 in Sheet1

class ManageFlatSpaceService {
    constructor() {
        this.axiosConfig = {
            headers: {
                "Content-Type": "application/json",
            },
        };
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        };
        return {
            getFlatSpaces: this.getFlatSpaces.bind(this),
            getFlatSpaceById: this.getFlatSpaceById.bind(this),
            getuserFlatSpaceById: this.getuserFlatSpaceById.bind(this),
            createFlatSpace: this.createFlatSpace.bind(this),
            updateFlatSpace: this.updateFlatSpace.bind(this),
            addPopularFlatSpaces: this.addPopularFlatSpaces.bind(this),
            sortPopularFlatSpaces: this.sortPopularFlatSpaces.bind(this),
            addPriorityFlatSpace: this.addPriorityFlatSpace.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeFlatSpaceStatus: this.changeFlatSpaceStatus.bind(this),
            deleteFlatSpace: this.deleteFlatSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
        };
    }

    async getFlatSpaces({
        limit = 10,
        sortBy = "name",
        orderBy = 1,
        skip,
        name,
        city,
        location,
        micro_location,
        shouldApprove = false,
        userid,
        for_sale,
        for_rent,
        status
    }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition["name"] = { $regex: `^(\s+${name}|^${name})`, $options: "i" };
            }
            if (city) {
                condition["location.city"] = city;
            }
            if (micro_location) {
                condition["location.micro_location"] = micro_location;
            }
            if (location) {
                location = ".*" + location + ".*";
                condition["location.name"] = {
                    $regex: new RegExp("^" + location + "$", "i"),
                };
            }
            if (shouldApprove) {
                condition["status"] = "approve";
                condition["is_active"] = true;
            }
            if (userid) {
                condition["user"] = userid;
            }
            if (for_sale) {
                condition["for_sale"] = true;
            }
            if (for_rent) {
                condition["for_rent"] = true;
            }
            if (status) {
                condition['status'] = status;
            }
            if (status == 'all') {
                delete condition['status']
            }

            result.FlatSpaces = await Flats.find(condition)
                .populate("location.city")
                .populate("location.country")
                .populate("images.image")
                .populate("coliving_plans.planId")
                .populate("user")
                .limit(limit)
                .skip(skip)
                .sort({
                    // [sortBy]: orderBy
                    createdAt: -1,
                });
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getFlatSpaceById({ FlatSpaceId }) {
        try {
            const FlatSpaces = await Flats.findOne({ _id: FlatSpaceId })
                .populate("amenties")
                .populate("images.image")
                .populate("seo.twitter.image")
                .populate("user")
                .populate("seo.open_graph.image");
            return FlatSpaces;
        } catch (error) {
            throw error;
        }
    }

    async getuserFlatSpaceById({ FlatSpaceId }) {
        try {
            const FlatSpaces = await Flats.findOne({ _id: FlatSpaceId })
                .populate("amenties")
                .populate("images.image")
                .populate("seo.twitter.image")
                .populate("user")
                .populate("location.city")
                .populate('location.micro_location')
                .populate("seo.open_graph.image");
            return FlatSpaces;
        } catch (error) {
            throw error;
        }
    }

    async createFlatSpace({
        name,
        actual_propertyname,
        description,
        images,
        amenties,
        other_detail,
        social_media,
        location,
        hours_of_operation,
        seo,
        coliving_plans,
        brand,
        user,
        for_sale,
        for_rent,
        building_type,
        property_type,
        builder_name,
        added_by_user,
        bhk_type,
        city_name,
        builder,
        subbuilder,
    }) {
        try {
            var expiryDate = new Date();
            var geometry;
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            let expireAt = expiryDate;
            let space_type_key = "flats";
            const d = new Date();
            let year = d.getFullYear();
            let totalCount = await Flats.countDocuments();
            let finalCount = totalCount + 1;
            let productId = `CFAP${year}${this.pad(finalCount)}`;

            if (location && location.latitude && location.longitude) {
                const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
                let country_name = countryInfo.name;
                let currency_code = getCountry(country_name).currency;
                geometry = this._setGeoLocation(location);
            }

            const slug = await this._createSlug(null, name, location.name);
            const country_details = await Country.findOne({ _id: location.country });
            let currency_code = getCountry(country_details.name).currency;
            let country_dbname = country_details.name;

            if (user) {

                //space details to official mailId...
                const userDetails = await User.findOne({ _id: user });
                let furnishing_type = other_detail.furnishing_type ?
                    other_detail.furnishing_type :
                    "fully-furnished";
                let build_up_arearent = other_detail.rent_per_bed;
                let amentiesDetails;
                let amenties_names = [];

                for (const key in amenties) {
                    amenties_names.push(amenties[key]["name"]);
                    amentiesDetails = amenties_names.join(", ");
                }

                let spaceAddress = location.address;
                let landmark = location.landmark;
                let near_metro = location.metro_stop_landmark;
                let img_count = images.length;

                const getTemplateObject = this._createTemplateObjects({
                    userDetails,
                    name,
                    builder_name,
                    property_type,
                    bhk_type,
                    furnishing_type,
                    build_up_arearent,
                    amentiesDetails,
                    city_name,
                    spaceAddress,
                });

                await aws.sendMail(getTemplateObject.listingParams);

                //space details to leadsquared...
                let lead_id = null;
                const body = this.sanitozeRequestBody({
                    userDetails,
                    name,
                    actual_propertyname,
                    builder_name,
                    property_type,
                    bhk_type,
                    furnishing_type,
                    build_up_arearent,
                    city_name,
                    spaceAddress,
                });

                // lead_id = await this.leadSquadApiCall(body);

                //space details to excelsheet...
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
                const day = now.getDate();
                const formattedDate = `${day}-${month}-${year}`;
                let want_to;
                let carpet_area;
                let monthly_maintance;
                if (for_sale) {
                    want_to = "Sale";
                }
                if (for_rent) {
                    want_to = "Rent";
                }
                let build_up_area = `${other_detail.built_up_area} sq. ft.`;
                if (other_detail.carpet_area) {
                    carpet_area = `${other_detail.carpet_area} sq. ft.`;
                }
                build_up_arearent = `${build_up_arearent} per/month`;
                let available_from = other_detail.available_from;
                if (other_detail.monthly_maintenance1 == 'Yes') {
                    monthly_maintance = `${other_detail.monthly_maintenance_amount} per/month`;
                } else {
                    monthly_maintance = other_detail.monthly_maintenance1;
                }
                const values = [
                    [
                        formattedDate,
                        city_name,
                        'Pending',
                        userDetails.name,
                        userDetails.email,
                        userDetails.phone_number,
                        description,
                        want_to,
                        building_type,
                        property_type,
                        bhk_type,
                        furnishing_type,
                        build_up_area,
                        carpet_area,
                        other_detail.bathroom,
                        other_detail.balcony,
                        other_detail.property_on_floor,
                        build_up_arearent,
                        available_from,
                        monthly_maintance,
                        other_detail.security_deposit,
                        amentiesDetails,
                        spaceAddress,
                        near_metro,
                        landmark,
                        img_count,
                    ],
                ];
                const resource = {
                    values,
                };
                await this.uploadToExcelsheet(resource)
            }

            return await Flats.create({
                name,
                description,
                currency_code,
                country_dbname,
                images,
                amenties,
                other_detail,
                social_media,
                location,
                hours_of_operation,
                seo,
                geometry,
                slug,
                coliving_plans,
                brand,
                user,
                for_sale,
                for_rent,
                expireAt,
                productId,
                building_type,
                property_type,
                builder_name,
                added_by_user,
                space_type_key,
                builder,
                subbuilder,
            });
        } catch (error) {
            throw error;
        }
    }

    //upload to excel sheet function...
    async uploadToExcelsheet(resource) {
        await web_query_sheet.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED", // Use user-entered values
            resource,
        },
            (err, result) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log(`cells updated.`);
            }
        );
    }

    sanitozeRequestBody({
        userDetails,
        name,
        builder_name,
        property_type,
        bhk_type,
        furnishing_type,
        build_up_arearent,
        city_name,
        spaceAddress,
    }) {
        try {
            const resposne = [{
                Attribute: "EmailAddress",
                Value: userDetails.email || "1test@qwert12.com",
            },
            {
                Attribute: "FirstName",
                Value: userDetails.name || "No Name",
            },
            {
                Attribute: "Phone",
                Value: userDetails.phone_number || "9715876567",
            },
            {
                Attribute: "mx_Name_of_space",
                Value: name || "",
            },
            {
                Attribute: "mx_Builder_Name",
                Value: builder_name || "",
            },
            {
                Attribute: "mx_Property_Type",
                Value: property_type || "",
            },
            {
                Attribute: "mx_BHK_Type",
                Value: bhk_type || "",
            },
            {
                Attribute: "mx_Furnishing_Type",
                Value: furnishing_type || "fully-furnished",
            },
            {
                Attribute: "mx_Rent",
                Value: build_up_arearent || 0,
            },
            {
                Attribute: "mx_City",
                Value: city_name || "No City (Generic)",
            },
            {
                Attribute: "mx_Street1",
                Value: spaceAddress || "",
            },
            {
                Attribute: "mx_Space_Type",
                Value: "RentSpace",
            },
                // {
                //     "Attribute": "RelatedCompanyId",
                //     "Value": 'ListingSpace'
                // },
            ];
            return resposne;
        } catch (error) {
            throw error;
        }
    }

    async leadSquadApiCall(body) {
        try {
            let lead_id = null;
            const response = await axios.post(
                `${app.leadSquaredUrl}LeadManagement.svc/Lead.Capture?accessKey=${app.leadSquaredAccessToken}&secretKey=${app.leadSquaredSecretKey}`,
                body,
                this.axiosConfig
            );
            if (response.data && response.data.Status === "Success") {
                lead_id = response.data.Message.Id;
            }
            return lead_id;
        } catch (error) {
            console.log(error);
        }
    }

    _createTemplateObjects({
        userDetails,
        name,
        builder_name,
        property_type,
        bhk_type,
        furnishing_type,
        build_up_arearent,
        amentiesDetails,
        city_name,
        spaceAddress,
    }) {
        let date = new Date();
        const options = { year: "numeric", month: "long", day: "numeric" };
        let visitorsDetail = userDetails.name.toUpperCase() + `<br />`;
        visitorsDetail += userDetails.phone_number + `<br />`;
        visitorsDetail += userDetails.email + `<br />`;
        return {
            listingParams: {
                toEmails: [app.listingEmail],
                templateName: "flat_listing",
                htmlVariables: {
                    centerName: name,
                    builder_name: builder_name,
                    property_type: property_type,
                    bhk_type: bhk_type,
                    furnishing_type: furnishing_type,
                    build_up_arearent: build_up_arearent,
                    amenties: amentiesDetails,
                    city: city_name,
                    address: spaceAddress,
                    date: date.toLocaleDateString("en-US", options),
                    time: date.toLocaleTimeString("en-US"),
                    visitorsDetail,
                },
                subjectVariables: {
                    userName: userDetails.name,
                    city: city_name,
                    spaceType: "Flat-Space",
                },
                bccAddresses: [],
                ccAddresses: [],
            },
        };
    }

    async updateFlatSpace({
        id,
        name,
        actual_propertyname,
        description,
        images,
        amenties,
        other_detail,
        social_media,
        location,
        seo,
        coliving_plans,
        brand,
        for_sale,
        for_rent,
        building_type,
        property_type,
        builder_name,
        added_by_user,
        builder,
        subbuilder,
        planStatus
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            const slug = await this._createSlug(id, name, location.name);
            const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
            let country_name = countryInfo.name;
            let currency_code = getCountry(country_name).currency;
            const country_details = await Country.findOne({ _id: location.country });
            let country_dbname = country_details.name;
            return await Flats.findOneAndUpdate({ _id: id }, {
                name,
                actual_propertyname,
                description,
                currency_code,
                country_dbname,
                images,
                amenties,
                other_detail,
                social_media,
                location,
                seo,
                geometry,
                slug,
                coliving_plans,
                brand,
                for_sale,
                for_rent,
                building_type,
                property_type,
                builder_name,
                added_by_user,
                builder,
                subbuilder,
                planStatus
            });
        } catch (error) {
            throw error;
        }
    }

    async changeFlatSpaceStatus({ FlatSpaceId, status, planStatus }) {
        try {
            let updateData = {};
            if (status === 'reject') {
                updateData = {
                    "status": status,
                    "priority.overall.is_active": false,
                    "priority.overall.order": 1000,
                    "priority.location.is_active": false,
                    "priority.location.order": 1000,
                    "priority.micro_location.is_active": false,
                    "priority.micro_location.order": 1000
                }
            } else {
                updateData = {
                    "status": status,
                }
            }
            if (planStatus) {
                updateData["planStatus"] = planStatus
            }
            return await Flats.findOneAndUpdate({ _id: FlatSpaceId }, { $set: updateData });
        } catch (error) {
            throw error;
        }
    }

    async addPopularFlatSpaces({ data }) {
        try {
            await Flats.update({ _id: data.id }, { $set: { is_popular: data.is_popular } });
            return true;
        } catch (error) {
            throw error;
        }
    }

    async sortPopularFlatSpaces({ initialPosition, finalPosition, shiftedId }) {
        try {
            if (initialPosition < finalPosition) {
                await Flats.updateMany({
                    "is_popular.order": { $lte: finalPosition, $gt: initialPosition },
                    "is_popular.value": true,
                }, { $inc: { "is_popular.order": -1 } });
                await Flats.updateOne({ _id: shiftedId }, { $set: { "is_popular.order": finalPosition } });
            }
            if (initialPosition > finalPosition) {
                await Flats.updateMany({
                    "is_popular.order": { $lt: initialPosition, $gte: finalPosition },
                    "is_popular.value": true,
                }, {
                    $inc: { "is_popular.order": 1 },
                });
                await Flats.updateOne({
                    _id: shiftedId,
                }, {
                    $set: { "is_popular.order": finalPosition },
                });
            }
        } catch (e) {
            throw e;
        }
    }

    async addPriorityFlatSpace({ id, type, data }) {
        try {
            let object = manageWorkSpaceService._createDynamicPriorityType(type);
            if (!data.is_active) {
                const { priority } = await Flats.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + ".order";
                const priorityActive = object + ".is_active";
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true,
                };
                if (data.city) {
                    condition["location.city"] = data.city;
                }
                await Flats.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1,
                    },
                });
            }
            await Flats.updateOne({ _id: id }, {
                $set: {
                    [object]: data,
                },
            });
            return true;
        } catch (error) {
            throw error;
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder =
                manageWorkSpaceService._createDynamicPriorityType(type) + ".order";
            const priorityActive =
                manageWorkSpaceService._createDynamicPriorityType(type) + ".is_active";
            if (initialPosition < finalPosition) {
                await Flats.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true,
                }, {
                    $inc: {
                        [priorityOrder]: -1,
                    },
                });
                await Flats.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition,
                    },
                });
            }
            if (initialPosition > finalPosition) {
                await Flats.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true,
                }, {
                    $inc: {
                        [priorityOrder]: 1,
                    },
                });
                await Flats.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition,
                    },
                });
            }
        } catch (e) {
            throw e;
        }
    }

    /** default lat long is used of Cyber Park Sector 67, Gurugram, Haryana 122005 */
    _setGeoLocation({
        latitude = 28.549670700000004,
        longitude = 77.21564350000001,
    }) {
        return {
            type: "Point",
            coordinates: [+longitude, +latitude],
        };
    }

    async _createSlug(id, name, location) {
        try {
            if (id) {
                const ws = await Flats.findOne({ _id: id });
                if (ws && ws.slug) {
                    return ws.slug;
                }
            }
            let slugName = `${name} ${location}`;
            slugName = slugName
                .toString()
                .toLowerCase()
                .replace(/\s+/g, "-") // Replace spaces with -
                .replace(/[^\w\-]+/g, "") // Remove all non-word chars
                .replace(/\-\-+/g, "-") // Replace multiple - with single -
                .replace(/^-+/, "") // Trim - from start of text
                .replace(/-+$/, ""); // Trim - from end of text
            const ws = await Flats.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + "-" + crypto.randomBytes(2).toString("hex");
            }
            return slugName;
        } catch (error) {
            throw error;
        }
    }

    async deleteFlatSpace({ id }) {
        try {
            const os = await Flats.findOne({ _id: id }).populate("images.image");
            os &&
                os.images.forEach(async (imageObject) => {
                    const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                    await Image.deleteOne({ _id: imageObject.image._id });
                    await FileUtility.deleteFile(imageObject.image.name, folder_name);
                });
            await Flats.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw error;
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await Flats.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException(
                    "Opps! Slug is already used by another Co-Living space"
                );
            }
            await Flats.findOneAndUpdate({ _id: id }, { slug });
            return true;
        } catch (error) {
            throw error;
        }
    }

    _throwException(message) {
        throw {
            name: "cofynd",
            code: 400,
            message,
        };
    }

    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
}

export default new ManageFlatSpaceService();