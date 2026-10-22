import {isDevInstance} from './InstanceBadge';

describe('isDevInstance', () => {
    it('treats the unstamped build as dev', () => expect(isDevInstance('develop')).toBe(true));
    it('treats stamped releases as prod', () => {
        expect(isDevInstance('fork-1.0.0')).toBe(false);
        expect(isDevInstance('0.8.3')).toBe(false);
    });
});
