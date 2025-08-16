// functions/rbac.js
const roleToPerms = {
    'General Manager': {
        is_gm: true,
        manage_settings: true,
        manage_roles: true,
        manage_employees: true,
        edit_schedule: true,
        view_schedule: true
    },
    'Manager': {
        is_manager: true,
        manage_employees: true,
        edit_schedule: true,
        view_schedule: true
    },
    'User': {
        is_user: true,
        view_schedule: true
    }
};

module.exports = { roleToPerms };