/**
 * Developer Tower Manager
 * Handles placement and management of pre-configured towers for testing and level design.
 */

/**
 * Spawn a developer tower for testing at the supplied normalized coordinates.
 * @this {SimplePlayfield}
 * @param {{x:number,y:number}} normalized
 * @param {{towerType?:string}} options
 * @returns {boolean}
 */
export function addDeveloperTower(normalized, options = {}) {
  const clamped = this.clampNormalized(normalized);
  if (!clamped) {
    return false;
  }
  const position = this.getCanvasPosition(clamped);
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return false;
  }

  const towerType = options.towerType || 'alpha';
  
  // Check if there's already a tower at this location
  const existingTower = this.findTowerAt(position);
  if (existingTower) {
    return false;
  }

  // Use the standard tower placement system with developer flag
  if (typeof this.placeTower === 'function') {
    const placed = this.placeTower(clamped, towerType, { isDeveloperTower: true });
    if (placed && this.messageEl) {
      this.messageEl.textContent = `Developer ${towerType} tower placed on battlefield.`;
    }
    return placed;
  }

  return false;
}

/**
 * Remove all developer towers from the battlefield.
 * @this {SimplePlayfield}
 * @param {{silent?:boolean}} options
 * @returns {number}
 */
export function clearDeveloperTowers(options = {}) {
  const { silent = true } = options;
  
  if (!Array.isArray(this.towers)) {
    return 0;
  }

  const developerTowers = this.towers.filter((tower) => tower?.isDeveloperTower === true);
  const count = developerTowers.length;

  if (count === 0) {
    return 0;
  }

  // Remove each developer tower
  developerTowers.forEach((tower) => {
    if (tower?.id && typeof this.removeTower === 'function') {
      this.removeTower(tower.id);
    }
  });

  if (!silent && this.messageEl) {
    this.messageEl.textContent = count > 0
      ? `Cleared ${count} developer tower${count === 1 ? '' : 's'} from the battlefield.`
      : 'No developer towers to clear.';
  }

  this.draw();
  return count;
}

/**
 * Find a developer tower at the supplied canvas position.
 * @this {SimplePlayfield}
 * @param {{x:number,y:number}} position
 * @returns {object|null}
 */
export function findDeveloperTowerAt(position) {
  if (!position || !Array.isArray(this.towers)) {
    return null;
  }

  const tower = this.findTowerAt(position);
  if (tower && tower.isDeveloperTower === true) {
    return tower;
  }

  return null;
}

/**
 * Remove a specific developer tower by ID.
 * @this {SimplePlayfield}
 * @param {string} towerId
 * @returns {boolean}
 */
export function removeDeveloperTower(towerId) {
  if (!towerId || !Array.isArray(this.towers)) {
    return false;
  }

  const tower = this.towers.find((t) => t?.id === towerId && t?.isDeveloperTower === true);
  if (!tower) {
    return false;
  }

  if (typeof this.removeTower === 'function') {
    const removed = this.removeTower(towerId);
    if (removed) {
      this.draw();
    }
    return removed;
  }

  return false;
}
