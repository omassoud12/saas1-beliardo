import { sendSuccess } from "../../shared/utils/response.js";
import { platformService } from "./platform.service.js";

export async function listOwners(_request, response, next) { try { return sendSuccess(response, { data: { owners: await platformService.listOwners() } }); } catch (error) { return next(error); } }
export async function listUsers(_request, response, next) { try { return sendSuccess(response, { data: { users: await platformService.listUsers() } }); } catch (error) { return next(error); } }
export async function changeOwnerStatus(request, response, next) { try { const result = await platformService.changeOwnerStatus({ actorUserId: request.auth.user.id, ...request.validated }); return sendSuccess(response, { data: { result }, message: "Owner access updated" }); } catch (error) { return next(error); } }
export async function updateUser(request, response, next) { try { const user = await platformService.updateUser({ actorUserId: request.auth.user.id, ...request.validated }); return sendSuccess(response, { data: { user }, message: "User updated" }); } catch (error) { return next(error); } }
export async function changeUserStatus(request, response, next) { try { const result = await platformService.changeUserStatus({ actorUserId: request.auth.user.id, ...request.validated }); return sendSuccess(response, { data: { result }, message: "User access updated" }); } catch (error) { return next(error); } }
export async function removeUser(request, response, next) { try { await platformService.removeUser({ actorUserId: request.auth.user.id, ...request.validated }); return sendSuccess(response, { message: "User access removed" }); } catch (error) { return next(error); } }
export async function listAuditLogs(_request, response, next) { try { return sendSuccess(response, { data: { logs: await platformService.listAuditLogs() } }); } catch (error) { return next(error); } }
