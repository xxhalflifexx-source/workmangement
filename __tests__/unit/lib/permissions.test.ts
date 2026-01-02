import {
  parsePermissions,
  hasPermission,
  getModuleNames,
  DEFAULT_PERMISSIONS,
  MODULE_ROUTES,
  type ModulePermission,
  type UserPermissions,
} from '@/lib/permissions';

describe('permissions', () => {
  describe('DEFAULT_PERMISSIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PERMISSIONS.timeClock).toBe(true);
      expect(DEFAULT_PERMISSIONS.jobManagement).toBe(true);
      expect(DEFAULT_PERMISSIONS.qualityControl).toBe(false);
      expect(DEFAULT_PERMISSIONS.hr).toBe(false);
      expect(DEFAULT_PERMISSIONS.finance).toBe(false);
      expect(DEFAULT_PERMISSIONS.inventory).toBe(false);
      expect(DEFAULT_PERMISSIONS.adminPanel).toBe(false);
      expect(DEFAULT_PERMISSIONS.operationsCommon).toBe(true);
      expect(DEFAULT_PERMISSIONS.incidentReports).toBe(true);
    });
  });

  describe('MODULE_ROUTES', () => {
    it('should have routes for all modules', () => {
      expect(MODULE_ROUTES.timeClock).toContain('/time-clock');
      expect(MODULE_ROUTES.jobManagement).toContain('/jobs');
      expect(MODULE_ROUTES.qualityControl).toContain('/qc');
      expect(MODULE_ROUTES.hr).toContain('/hr');
      expect(MODULE_ROUTES.finance).toContain('/finance');
      expect(MODULE_ROUTES.inventory).toContain('/inventory');
      expect(MODULE_ROUTES.adminPanel).toContain('/admin');
      expect(MODULE_ROUTES.operationsCommon).toContain('/operations-common');
      expect(MODULE_ROUTES.incidentReports).toContain('/incident-reports');
    });
  });

  describe('parsePermissions', () => {
    it('should return default permissions for null input', () => {
      const result = parsePermissions(null);
      expect(result).toEqual(DEFAULT_PERMISSIONS);
    });

    it('should return default permissions for undefined input', () => {
      const result = parsePermissions(undefined);
      expect(result).toEqual(DEFAULT_PERMISSIONS);
    });

    it('should return default permissions for empty object string', () => {
      const result = parsePermissions('{}');
      expect(result).toEqual(DEFAULT_PERMISSIONS);
    });

    it('should parse valid JSON and merge with defaults', () => {
      const input = JSON.stringify({ qualityControl: true, hr: true });
      const result = parsePermissions(input);
      
      expect(result.qualityControl).toBe(true);
      expect(result.hr).toBe(true);
      // Defaults should remain
      expect(result.timeClock).toBe(true);
      expect(result.jobManagement).toBe(true);
    });

    it('should override default values with parsed values', () => {
      const input = JSON.stringify({ timeClock: false, jobManagement: false });
      const result = parsePermissions(input);
      
      expect(result.timeClock).toBe(false);
      expect(result.jobManagement).toBe(false);
    });

    it('should return default permissions for invalid JSON', () => {
      const result = parsePermissions('not valid json');
      expect(result).toEqual(DEFAULT_PERMISSIONS);
    });

    it('should handle partial permission objects', () => {
      const input = JSON.stringify({ finance: true });
      const result = parsePermissions(input);
      
      expect(result.finance).toBe(true);
      expect(result.timeClock).toBe(true); // Default
      expect(result.adminPanel).toBe(false); // Default
    });
  });

  describe('hasPermission', () => {
    it('should return true for default-enabled modules with null permissions', () => {
      expect(hasPermission(null, 'timeClock')).toBe(true);
      expect(hasPermission(null, 'jobManagement')).toBe(true);
      expect(hasPermission(null, 'operationsCommon')).toBe(true);
      expect(hasPermission(null, 'incidentReports')).toBe(true);
    });

    it('should return false for default-disabled modules with null permissions', () => {
      expect(hasPermission(null, 'qualityControl')).toBe(false);
      expect(hasPermission(null, 'hr')).toBe(false);
      expect(hasPermission(null, 'finance')).toBe(false);
      expect(hasPermission(null, 'adminPanel')).toBe(false);
    });

    it('should parse string permissions', () => {
      const permStr = JSON.stringify({ qualityControl: true, hr: true });
      
      expect(hasPermission(permStr, 'qualityControl')).toBe(true);
      expect(hasPermission(permStr, 'hr')).toBe(true);
      expect(hasPermission(permStr, 'finance')).toBe(false); // Still default
    });

    it('should use object permissions directly', () => {
      const perms: UserPermissions = {
        timeClock: false,
        finance: true,
        adminPanel: true,
      };
      
      expect(hasPermission(perms, 'timeClock')).toBe(false);
      expect(hasPermission(perms, 'finance')).toBe(true);
      expect(hasPermission(perms, 'adminPanel')).toBe(true);
    });

    it('should fall back to defaults for undefined module in object', () => {
      const perms: UserPermissions = { finance: true };
      
      expect(hasPermission(perms, 'timeClock')).toBe(true); // Default true
      expect(hasPermission(perms, 'qualityControl')).toBe(false); // Default false
    });
  });

  describe('getModuleNames', () => {
    it('should return human-readable names for all modules', () => {
      const names = getModuleNames();
      
      expect(names.timeClock).toBe('Time Clock');
      expect(names.jobManagement).toBe('Job Management');
      expect(names.qualityControl).toBe('Quality Control');
      expect(names.hr).toBe('HR');
      expect(names.finance).toBe('Finance');
      expect(names.inventory).toBe('Inventory');
      expect(names.adminPanel).toBe('Admin Panel');
      expect(names.operationsCommon).toBe('Operations Common');
      expect(names.incidentReports).toBe('Incident Reports');
    });

    it('should have a name for every module permission type', () => {
      const names = getModuleNames();
      const modules: ModulePermission[] = [
        'timeClock',
        'jobManagement',
        'qualityControl',
        'hr',
        'finance',
        'inventory',
        'adminPanel',
        'operationsCommon',
        'incidentReports',
      ];
      
      modules.forEach(module => {
        expect(names[module]).toBeDefined();
        expect(typeof names[module]).toBe('string');
        expect(names[module].length).toBeGreaterThan(0);
      });
    });
  });
});

