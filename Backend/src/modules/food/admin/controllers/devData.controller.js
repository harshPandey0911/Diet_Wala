import { sendResponse } from '../../../../utils/response.js';
import { listDevDataSections, deleteDevDataSection } from '../services/devData.service.js';

export async function getDevDataSections(req, res, next) {
    try {
        const sections = await listDevDataSections();
        return sendResponse(res, 200, 'Data sections fetched successfully', { sections });
    } catch (error) {
        next(error);
    }
}

export async function deleteDevData(req, res, next) {
    try {
        const result = await deleteDevDataSection(req.params.section, req.body?.confirmText, req.user);
        return sendResponse(res, 200, `Deleted ${result.total} record(s)`, result);
    } catch (error) {
        next(error);
    }
}
