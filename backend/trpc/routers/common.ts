import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import prisma from 'src/lib/prismaClient';

export const commonRouter = router({
    postcodeAutocomplete: protectedProcedure
    .input(z.object({ postcode: z.string() }))
    .query(async (opts) => {
    const { postcode } = opts.input;
    const apiKey = process.env.NEXT_PUBLIC_GETADDRESS_API_KEY;
    const response = await fetch(`https://api.getaddress.io/autocomplete/${postcode}?api-key=${apiKey}`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch address data');
    }

    const data = await response.json();
    return data;
    }),


    fpCallback: publicProcedure.input(z.object({
        fp_cot: z.string(),
        fp_status: z.string(),
    }))
    .query(async (opts) => {
        const { fp_cot, fp_status } = opts.input;
        const fpConnectSession = await prisma.fPConnectSession.findFirst({
            where: {
                fp_cot,
            },
        });

        
        if (!fpConnectSession) {
            throw new Error('Connect Session not found');
        }

        if (fp_status === 'success') {

            await prisma.fPConnectSession.update({
                where: {
                    id: fpConnectSession.id,
                },
                data: {
                    fp_status,
                },
            });

            // TODO: GET location_id
            const locationId = "mock123"
            
            try {
                await prisma.site.create({
                    data: {
                        siteName: fpConnectSession.siteName,
                        locationId,
                        user: {
                            connect: { id: fpConnectSession.userId }
                        },
                        address: {
                            connect: { id: fpConnectSession.addressId }
                        },
                    },
                });
            } catch (error) {
                throw new Error('Failed to create site', error);
            }

        }else {
            await prisma.fPConnectSession.update({
                where: {
                    id: fpConnectSession.id,
                },
                data: {
                    fp_status: 'fail',
                },
            });
        }
    }),




    addAddress: protectedProcedure.input(z.object({
        id: z.string(),
    })).mutation(async (opts) => {
        const { id } = opts.input;
        const apiKey = process.env.NEXT_PUBLIC_GETADDRESS_API_KEY;
        const existingAddress = await prisma.address.findUnique({
            where: {
                id
            },
        });

        if (existingAddress) {
            return;
        }
        const response = await fetch(`https://api.getaddress.io/get/${id}?api-key=${apiKey}`);
        const addressData = await response.json();
        await prisma.address.create({
            data: {
                id,
                latitude: addressData.latitude,
                longitude: addressData.longitude,
                formattedAddress: addressData.formatted_address,
                thoroughfare: addressData.thoroughfare,
                buildingName: addressData.building_name,
                subBuildingName: addressData.sub_building_name,
                subBuildingNumber: addressData.sub_building_number,
                buildingNumber: addressData.building_number,
                lineOne: addressData.line_1,
                lineTwo: addressData.line_2,
                lineThree: addressData.line_3,
                lineFour: addressData.line_4,
                postcode: addressData.postcode,
                locality: addressData.locality,
                townOrCity: addressData.town_or_city,
                county: addressData.county,
                district: addressData.district,
                country: addressData.country,
                residential: addressData.residential,
            }
        });
    })

})