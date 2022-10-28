// debug
console.log(mazeSeed);
const mazeScale = 128;
let pixelSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--pixel-size'));

// mapping keys to movement directions
const directions = {
    up: "up",
    down: "down",
    left: "left",
    right: "right"
}

const directionKeys = {
    'w': directions.up,
    'a': directions.left,
    'd': directions.right,
    's': directions.down,
    'ArrowUp': directions.up,
    'ArrowLeft': directions.left,
    'ArrowRight': directions.right,
    'ArrowDown': directions.down,
    'W': directions.up,
    'A': directions.left,
    'S': directions.down,
    'D': directions.right
}

const inventoryKeys = {
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5
}

const commands = {
    'e': 'interact',
    'E': 'interact',
    'q': 'drop',
    'Q': 'drop',
    'r': 'attack',
    'R': 'attack'
}

const toBinary = {'A': '000000', 'B': '000001', 'C': '000010', 'D': '000011', 'E': '000100', 'F': '000101',
                    'G': '000110', 'H': '000111',
                    'I': '001000', 'J': '001001', 'K': '001010', 'L': '001011', 'M': '001100', 'N': '001101',
                    'O': '001110', 'P': '001111',
                    'Q': '010000', 'R': '010001', 'S': '010010', 'T': '010011', 'U': '010100', 'V': '010101',
                    'W': '010110', 'X': '010111',
                    'Y': '011000', 'Z': '011001', 'a': '011010', 'b': '011011', 'c': '011100', 'd': '011101',
                    'e': '011110', 'f': '011111',
                    'g': '100000', 'h': '100001', 'i': '100010', 'j': '100011', 'k': '100100', 'l': '100101',
                    'm': '100110', 'n': '100111',
                    'o': '101000', 'p': '101001', 'q': '101010', 'r': '101011', 's': '101100', 't': '101101',
                    'u': '101110', 'v': '101111',
                    'w': '110000', 'x': '110001', 'y': '110010', 'z': '110011', '0': '110100', '1': '110101',
                    '2': '110110', '3': '110111',
                    '4': '111000', '5': '111001', '6': '111010', '7': '111011', '8': '111100', '9': '111101',
                    '-': '111110', '_': '111111'}


class ObjectGroup{
    constructor(objectType) {
        this.objectType = objectType;
        this.objectList = [];
        //this.idToIndex = {};
    }

    get(index){
        return this.objectList[index];
    }

    push(object){
        this.objectList.push(object);
        //this.idToIndex[object.id] = this.objectList.length-1
        return new ObjectGroupReference(object.type, this.objectList.length-1, this)
    }
}


class ObjectGroupReference{
    constructor(objectType, index, objectGroup) {
        this.objectType = objectType;
        this._index = index;
        this._objectGroup = objectGroup;
    }

    getSelf(){
        return this._objectGroup.get(this._index);
    }
}


class Item{
    constructor(type, id) {
        this.type = type;
        this.entity = new ItemEntity(0, 0)
        this.id = id;
        this.entity.self.id = type;
    }

    place(y, x){
        this.entity.move(y, x)
    }

    take(){
        this.entity.remove()
    }

    update(){
        this.entity.updatePosition()
    }
}


class Lock extends Item{
    constructor() {
        super('lock')
        this._locked = true;
    }

    unlock(){
        this._locked = false;
        this.entity.self.outerHTML = "";
    }
}


class NodeList{
    constructor() {
        this.dict = {};
        this._keys = [];
    }

    getKeyFromPos(position){
        return 'y' + String(position.y) + 'x' + String(position.x);
    }

    push(node){
        let position = node.position();
        this.dict[this.getKeyFromPos(position)] = node;
        this._keys.unshift(node.position());
    }

    pop(){
        if (this._keys){
            let position = this._keys.shift();
            let key = this.getKeyFromPos(position);
            delete this.dict[key];
            return position;
        } else {
            return undefined;
        }
    }

    delete(position){
        let key = this.getKeyFromPos(position);
        delete this.dict[key];
        this._keys = this._keys.filter(function(e) { return e !== key});
    }

    contains(position){
        let key = this.getKeyFromPos(position);
        return key in this.dict;
    }
}


class Node{
    constructor(y, x, walls) {
        this.type = 'node'
        this.x = x;
        this.y = y;
        this.top = walls.top;
        this.bottom = walls.bottom;
        this.left = walls.left;
        this.right = walls.right;
        this.contains = undefined;
    }

    position(){
        return {y: this.y, x: this.x};
    }
}


class HorizontalEdge extends Node{
    constructor(y, x) {
        let walls = { top: 1, bottom: 1, left: 0, right: 0 };
        super(y, x, walls);
        this.type = 'edge';
    }
}


class VerticalEdge extends Node{
    constructor(y, x) {
        let walls = { top: 0, bottom: 0, left: 1, right: 1 };
        super(y, x, walls);
        this.type = 'edge';
    }
}


class Maze {

    constructor(seed) {
        this.seed = seed;
        this._usedEdges = {};
        this.adjacencyList = [];

        // separating dimensions from seed and converting to binary
        let base64String = this.seed.replace(/=/g, '');
        let binaryString = '';
        for (let i = 0; i < base64String.length; i++){
            binaryString += toBinary[base64String[i]];
        }
        let padding = (this.seed.length - base64String.length)*8;
        this.height = parseInt(binaryString.slice(0,8), 2);
        this.width = parseInt(binaryString.slice(8,16), 2);
        this.binaryString = binaryString.slice(16, binaryString.length - padding);
        console.log(binaryString,this.height, this.width);
    }

    checkTileInMaze(y, x){
        if ((1 > x || x > this.width) || (1 > y || y > this.height)){
            return false;
        } else if (x % 1 === 0 && y % 1 === 0){
            return true;
        } else if (y % 1 !== 0 && x % 1 === 0){
            let adjTile = this.adjacencyList[Math.floor(y) - 1][x - 1];
            if (adjTile.bottom === 0){
                return true;
            }
        } else if (x % 1 !== 0 && y % 1 === 0){
            let adjTile = this.adjacencyList[y - 1][Math.floor(x) - 1];
            if (adjTile.right === 0){
                return true;
            }
        }
        return false;
    }

    checkUsedEdge(tile){
        if (tile.type === 'edge'){
            if (tile.contains === undefined){
                // concatenate y and x values to create a unique key for any edge
                delete this._usedEdges[String(tile.y)+String(tile.x)]
            } else {
                this._usedEdges[String(tile.y)+String(tile.x)] = tile
            }
        }
    }

    getNode(y, x){
        if (this.checkTileInMaze(y, x)) {
            if (x % 1 === 0 && y % 1 === 0){
                return this.adjacencyList[y - 1][x - 1];
            } else {
                let edgeUsed = this._usedEdges[String(y)+String(x)]
                if (edgeUsed !== undefined){
                    return edgeUsed
                } else {
                    if (x % 1 !== 0) {
                        return new HorizontalEdge(y, x);
                    } else if (y % 1 !== 0) {
                        return new VerticalEdge(y, x);
                    }
                }
            }
        }
        return false;
    }

    output(){
        console.log(this.adjacencyList);
    }
}


class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this._speed = 0;
        this._prevTile = {y: 0, x:0};
        this.currentTile = {y: 0, x:0};
        this._tileOrigin = {y: 0, x:0}
        this.move_directions = [];
        this._attackCooldown = 0;
        this._attackDamage = 0;
    }

    // function to round a number to the nearest 0.5
    roundTileCoord(tileCoord) {
        if (tileCoord - Math.floor(tileCoord) > 0.5) {
            tileCoord = Math.floor(tileCoord) + 0.5;
        } else {
            tileCoord = Math.floor(tileCoord);
        }
        return tileCoord;
    }

    determineCurrentTile(){
        // store previous node to know where its walls where
        this._prevTile.x = this.currentTile.x;
        this._prevTile.y = this.currentTile.y

        // work out which tile in the spanning tree the entity is in
        let x = this.roundTileCoord((this.x / mazeScale) + 1);
        let y = this.roundTileCoord((this.y / mazeScale) + 1);

        this.currentTile = game.maze.getNode(y, x);
        this.determineTileOrigin();
    }

    determineTileOrigin(){
        // get the coordinates of the tile and data from spanning tree
        this._tileOrigin.x = (this.currentTile.x - 1) * mazeScale;
        this._tileOrigin.y = (this.currentTile.y - 1) * mazeScale;
    }

    checkCollision(originalX, originalY) {
        // maze wall collisions
        // top, bottom, left, right

        this.determineCurrentTile();

        // left
        if (this.x < this._tileOrigin.x + 3) {
            if (this.currentTile.left === 1) {
                this.x = originalX;
            } else if (this.currentTile.left === 0 && (this.y > this._tileOrigin.y + 46 || this.y < this._tileOrigin.y + 5)) {
                // corner correction
                this.y = originalY;
            }
        }
        // right
        if (this.x > this._tileOrigin.x + 45) {
            if (this.currentTile.right === 1) {
                this.x = originalX;
            } else if (this.currentTile.right === 0 && (this.y > this._tileOrigin.y + 46 || this.y < this._tileOrigin.y + 5)) {
                this.y = originalY;
            }
        }
        // top
        if (this.y < this._tileOrigin.y + 5) {
            if (this.currentTile.top === 1) {
                this.y = originalY;
            } else if (this.currentTile.top === 0 && (this.x < this._tileOrigin.x + 3|| this.x > this._tileOrigin.x + 45)) {
                this.x = originalX;
            }
        }
        // bottom
        if (this.y > this._tileOrigin.y + 46) {
            if (this.currentTile.bottom === 1) {
                this.y = originalY;
            } else if (this.currentTile.bottom === 0 && (this.x < this._tileOrigin.x + 3|| this.x > this._tileOrigin.x + 45)) {
                this.x = originalX;
            }
        }
    }

    move() {
        if (this.move_directions.length > 0){

            
            // storing position from previous frame in case new position is blocked
            let originalX = this.x;
            let originalY = this.y;


            this.determineCurrentTile();

            for (let i = 0; i < this.move_directions.length; i++) {
                switch (this.move_directions[i]) {
                    case directions.right:
                        this.x += this._speed;
                        break;
                    case directions.left:
                        this.x -= this._speed;
                        break;
                    case directions.down:
                        this.y += this._speed;
                        break;
                    case directions.up:
                        this.y -= this._speed;
                        break;
                }
            }

            this.checkCollision(originalX, originalY);
            this.self.setAttribute("facing", this.move_directions[0]);
            this.self.setAttribute("walking", "true");

        } else {
            this.self.setAttribute("walking", "false");
        }
    }

    getCurrentTile(){
        return this.currentTile;
    }

    attack(target){
        if (this.self.getAttribute("attacking") !== "true"){
            this.self.setAttribute("attacking", "true");
            if (target.x <= this.x){
                this.self.setAttribute("facing", "left");
            } else if (target.x > this.x) {
                this.self.setAttribute("facing", "right")
            }
            target.damage(this._attackDamage)
            window.setTimeout(function (self){
                self.setAttribute("attacking", "false");
            }, this._attackCooldown, this.self)
        }
    }
}


class ItemEntity extends Entity{
    constructor() {
        super(20, 28);
        this.determineCurrentTile();
        this.self = document.createElement("div");
        this.self.className = "item"
    }

    determineCurrentTile(y, x){
        // work out which tile in the spanning tree the entity is in
        let tileX = this.roundTileCoord((x / mazeScale) + 1);
        let tileY = this.roundTileCoord((y / mazeScale) + 1);

        this.determineTileOrigin(tileY, tileX)
    }

    determineTileOrigin(tileY, tileX){
        // get the coordinates of the tile and data from spanning tree
        this._tileOrigin.x = (tileX - 1) * mazeScale;
        this._tileOrigin.y = (tileY - 1) * mazeScale;
    }

    spawn(tileY, tileX){
        this.determineTileOrigin(tileY, tileX)
        this.move(this._tileOrigin.y+32, this._tileOrigin.x+24)
    }

    updatePosition(){
        this.self.style.transform = `translate3d( ${this.x * pixelSize}px, ${this.y * pixelSize}px, 0 )`;
    }

    move(y, x){
        game.map.appendChild(this.self)
        this.x = x;
        this.y = y;
        this.updatePosition()
        //this.self.style.visibility = 'visible';
    }

    remove(){
        //this.self.style.visibility = 'hidden';
        this.self.outerHTML = "";
    }
}


class Enemy extends Entity {
    constructor(id) {
        super(27, 16);
        this.id = id;
        this._speed = 7/8;
        this.range = 3;
        this.maxHealth = 10;
        this.health = this.maxHealth;
        this._attackCooldown = 1000;
        this._attackDamage = 3;
        this.path = [];
        this.target = {y: -1, x: -1};
        this.targetTile = {};
        this.self = document.createElement("div");
        this.self.className = "enemy"
        this.self.id = `enemy-${this.id}`
    }

    spawn(tileY, tileX){
        this.self.setAttribute("attacking", "false")

        this.x = (tileX -1) * mazeScale + 20;
        this.y = (tileY -1) * mazeScale + 40;
        this.currentTile = {y: tileY, x: tileX};
        game.map.appendChild(this.self)

        let spriteSheet = document.createElement("div")
        spriteSheet.className = "enemy-spritesheet"
        this.self.appendChild(spriteSheet)

        this.self.style.transform = `translate3d( ${this.x * pixelSize}px, ${this.y * pixelSize}px, 0 )`;
        this.healhBar = new HealthBar(this.self.id, this.maxHealth);
    }

    damage(damageTaken){
        this.health -= damageTaken
        if (this.health <= 0){
            this.health = 0;
            this.self.outerHTML = "";
            game.player.enemiesKilled += 1;
            for (let index = 0; index < game.enemyGroup.objectList.length; index++){
                let enemy = game.enemyGroup.objectList[index]
                if (enemy.id === this.id){
                    console.log(enemy, game.enemyGroup.objectList)
                    game.enemyGroup.objectList.splice(index, 1)
                    break
                }
            }
        }
        this.healhBar.update(this.health);
    }

    pathFind(){
        //console.log(this.targetTile)
        let targetPosition = this.targetTile.position();
        if (this.path.length > 0 || (targetPosition.y === this.currentTile.y && targetPosition.x === this.currentTile.x)){
            return;
        }
        let min = {y: this.currentTile.y - this.range/2, x: this.currentTile.x - this.range/2};
        let max = {y: this.currentTile.y + this.range/2, x: this.currentTile.x + this.range/2};

        // enemy should only find a path if the target is within its range
        if (min.y <= this.targetTile.y && this.targetTile.y <= max.y && min.x <= this.targetTile.x && this.targetTile.x <= max.x){

            let nodesInRange = new NodeList();
            //console.log('search start', this.currentTile, this.targetTile.position());

            for (let row = min.y; row <= max.y; row += 0.5){
                for (let column = min.x; column <= max.x; column += 0.5){
                    let node = game.maze.getNode(row, column);
                    if (node){
                        nodesInRange.push(node);
                    }
                }
            }
            // recursive backtracking starts at target for better efficiency
            // * explain in design
            let checkTile = this.targetTile;
            let checkPosition = checkTile.position();
            let visitedNodes = new NodeList();

            while(true){
                if (checkPosition.y === this.currentTile.y && checkPosition.x === this.currentTile.x){
                    // has found player
                    //console.log('player found', this.path)
                    break;
                }

                // ensures a node is not checked twice
                nodesInRange.delete(checkPosition);
                let nextPosition = checkPosition;
                let direction = "";

                // if the player is in an adjacent tile, the correct direction is known
                if (nextPosition.x === this.currentTile.x && nextPosition.y + 0.5 === this.currentTile.y){
                    nextPosition.y += 0.5;
                    direction = "up";

                } else if (nextPosition.x === this.currentTile.x && nextPosition.y - 0.5 === this.currentTile.y){
                    nextPosition.y -= 0.5;
                    direction = "down";

                } else if (nextPosition.y === this.currentTile.y && nextPosition.x - 0.5 === this.currentTile.x){
                    nextPosition.x -= 0.5;
                    direction = "right";

                } else if (nextPosition.y === this.currentTile.y && nextPosition.x + 0.5 === this.currentTile.x){
                    nextPosition.x += 0.5;
                    direction = "left";

                // when the player is not in an adjacent tile, tiles are checked using recursive backtracking
                } else if (checkTile.top === 0 && nodesInRange.contains({y: nextPosition.y - 0.5, x: nextPosition.x})){
                    nextPosition.y -= 0.5;
                    direction = "down";

                } else if (checkTile.bottom === 0 && nodesInRange.contains({y: nextPosition.y + 0.5, x: nextPosition.x})){
                    nextPosition.y += 0.5;
                    direction = "up";

                } else if (checkTile.left === 0 && nodesInRange.contains({y: nextPosition.y, x: nextPosition.x - 0.5})){
                    nextPosition.x -= 0.5;
                    direction = "right";

                } else if (checkTile.right === 0 && nodesInRange.contains({y: nextPosition.y, x: nextPosition.x + 0.5})){
                    nextPosition.x += 0.5;
                    direction = "left";

                } else {
                    // can't find player
                    if (this.path.length !== 0) {
                        this.path.shift();
                        checkPosition = visitedNodes.pop();
                    } else {
                        break;
                    }
                }
                if (nodesInRange.contains(nextPosition)){
                    this.path.unshift(direction);
                    visitedNodes.push(checkTile);
                    checkPosition = nextPosition;
                    checkTile = nodesInRange.dict[nodesInRange.getKeyFromPos(checkPosition)];
                }
            }
        }
    }

    move(){
        this.determineTileOrigin();
        this.targetTile = game.player.getCurrentTile();

        if (this.targetTile.x === this.currentTile.x && this.targetTile.y === this.currentTile.y) {
            // set player as target
            //console.log('2', this.targetTile.x, this.targetTile.y, this.currentTile.x, this.currentTile.y);
            this.target.x = game.player.x;
            this.target.y = game.player.y;

        } else {
            this.pathFind();
        }

        //console.log(this.y, this.x, this.currentTile.x, this.currentTile.y, this.tileOrigin, this.target, this.path)
        if (this.target.x !== -1 && this.target.y !== -1) {
            //console.log('1', this.target, this.y, this.x);
            // move towards target
            this.move_directions = [];
            if (this.x - 2 > this.target.x) {
                this.move_directions.push(directions.left);
            } else if (this.x + 2 < this.target.x) {
                this.move_directions.push(directions.right);
            }
            if (this.y - 2 > this.target.y) {
                this.move_directions.push(directions.up);
            } else if (this.y + 2 < this.target.y) {
                this.move_directions.push(directions.down);
            }
            if (this.move_directions.length > 0) {
                super.move();
            } else {
                //console.log(this.target, this.path)
                this.target.x = this.target.y = -1;
                this.path.shift();
            }
        }
        if (this.path.length > 0 && this.target.x === -1 && this.target.y === -1){
            //console.log('3', this.path);
            // move to next tile
            this.move_directions = [];
            this.move_directions.push(this.path[0]);
            super.move();
            //console.log(this.currentTile, this.prevTile)
            if (this.currentTile.x !== this._prevTile.x || this.currentTile.y !== this._prevTile.y) {
                this.target = {y: this._tileOrigin.y + 25, x: this._tileOrigin.x + 25};
                //console.log(this.tileOrigin, this.target)
            }
        }
        this.self.style.transform = `translate3d( ${this.x * pixelSize}px, ${this.y * pixelSize}px, 0 )`;
    }

    attack(){
        let distance = Math.sqrt(Math.abs(this.x - game.player.x) **2 + Math.abs(this.y  - game.player.y )**2);
        if (distance < 5) {
            super.attack(game.player)
        }
    }
}


class Player extends Entity {
    constructor() {
        super(27, 16);
        this._prevTile = {y:0, x:0};
        this.maxHealth = 50;
        this.health = this.maxHealth;
        this.currentTile = game.maze.getNode(1, 1);
        this._speed = 1;
        this._attackCooldown = 200;
        this._attackDamage = 5;
        this.inventory = new Inventory();
        this.self = document.querySelector('.character');
        this.healthBar = new HealthBar('character-1', this.maxHealth)
        this.enemiesKilled = 0
        this.locksOpened = 0
        }

    executeCommand(command){
        switch (command){
            case 'interact':
                this.interact();
                break;
            case 'drop':
                this.drop();
                break;
            case 'attack':
                this.attack();
                break;
        }
    }

    interact(){
        if (this.currentTile.contains !== undefined){
            if (this.currentTile.contains.objectType === 'lock'){
                let lock = this.currentTile.contains.getSelf()
                let itemReference = this.inventory.getItemFromSlot(game.activeInventorySlot);
                if (itemReference.objectType === 'key'){
                    lock.unlock();
                    this.currentTile.contains = undefined;
                    this.inventory.removeItem(game.activeInventorySlot);
                    this.locksOpened += 1;
                    game.checkWinCondition();
                }
            } else {
                let itemReference = this.currentTile.contains;
                this.inventory.insertItem(itemReference, game.activeInventorySlot);
                this.currentTile.contains.getSelf().take()
                this.currentTile.contains = undefined;
                game.maze.checkUsedEdge(this.currentTile);
            }
        }
    }

    attack(){
        if (this.inventory.getItemFromSlot(game.activeInventorySlot).objectType === 'sword'){
            let closestEnemy = game.enemyGroup.objectList[0]
            let closestDistance = 10
            let enemyInRange = false
            for (const enemy of game.enemyGroup.objectList) {
                if (enemy.currentTile.x === this.currentTile.x && enemy.currentTile.y === enemy.currentTile.y) {
                    let distance = Math.sqrt(Math.abs(this.x - enemy.x) **2 + Math.abs(this.y  - enemy.y )**2)
                    if (distance < closestDistance){
                        closestDistance = distance
                        closestEnemy = enemy
                        enemyInRange = true
                    }
                }
            }
            if (enemyInRange) {
                super.attack(closestEnemy)
            }
        }
    }

    drop(){
        if (this.inventory.getItemFromSlot(game.activeInventorySlot) !== undefined && this.currentTile.contains === undefined){
            this.currentTile.contains = this.inventory.removeItem(game.activeInventorySlot);
            this.currentTile.contains.getSelf().place(this.y, this.x)
            game.maze.checkUsedEdge(this.currentTile)
        }
    }

    damage(damageTaken){
        this.health -= damageTaken;
        if (this.health <= 0){
            this.health = 0;
            game.gameEnd(false)
        }
        this.healthBar.update(this.health)
    }

    move(){
        let mapX = this.x;
        let mapY = this.y;

        this.move_directions = game.held_directions;
        super.move();

        let widthM = game.imgWidth
        let heightM = game.imgHeight
        // smooth camera movement - moves the map against the player while the player is in the centre of the map
        if (mapX < 112) { mapX = 112; } // left
        if (mapX > widthM - 112) { mapX = widthM - 112; } // right
        if (mapY < 112) { mapY = 112; } // tops
        if (mapY > heightM - 112) { mapY = heightM - 112; } // bottom
        let camera_top = pixelSize * 112;
        let camera_left = pixelSize * 112;

        // moving the map and player
        game.map.style.transform = `translate3d( ${-mapX * pixelSize + camera_left}px, ${-mapY * pixelSize + camera_top}px, 0 )`;
        this.self.style.transform = `translate3d( ${this.x * pixelSize}px, ${this.y * pixelSize}px, 0 )`;
    }
}


class Inventory {
    constructor(){
        this._size = 5;
        this._contents = [undefined, undefined, undefined, undefined, undefined];
    }

    _setDocumentInventorySlot(slot, type){
        let slotView = document.getElementById(slot).firstElementChild;
        if (type !== null){
            slotView.id = type
        } else {
            slotView.id = "";
        }
    }

    getItemFromSlot(slot){
        if (this._contents[slot] !== undefined){
            return this._contents[slot];
        } else {
            return false;
        }
    }

    insertItem(itemReference, activeSlot){
        let slot = '';
        for (let index = 0; index < this._size; index++){
            if (this._contents[index] === undefined){
                this._contents[index] = itemReference;
                slot = 'slot-' + index.toString();
                break;
            } else if (index === this._size-1){
                //this.contents[activeSlot].drop();
                this._contents[activeSlot] = itemReference;
                slot = 'slot-' + activeSlot.toString();
            }
        }
        this._setDocumentInventorySlot(slot, itemReference.objectType)
    }

    removeItem(activeSlot){
        let itemReference = this._contents[activeSlot];
        this._contents[activeSlot] = undefined;
        this._setDocumentInventorySlot('slot-' + activeSlot.toString(), null)
        return itemReference;
    }
}


class HealthBar{
    constructor(parentId, maxHealth) {
        this._maxHealth = maxHealth
        let parent = document.getElementById(parentId)
        this._self = document.createElement("div");
        this._self.className = "health_bar"
        parent.appendChild(this._self)
        this.update(maxHealth)
    }

    update(health){
        this._self.style.width= `${(health/this._maxHealth) * 50}%`
    }
}


class GameController{
    constructor() {
        this._gameOver = false;

        this.itemGroup = new ObjectGroup('item');
        this.lockGroup = new ObjectGroup('lock');
        this.enemyGroup = new ObjectGroup('enemy');

        this.held_directions = [];
        this.activeInventorySlot = 0;
        document.getElementById(`slot-${this.activeInventorySlot}`).style.backgroundImage = "url(/static/img/active_slot.png)"

        this.map = document.querySelector('.map');
        this.endScreen = document.querySelector('.end-screen')
        this.level = document.querySelector('.level')

        this.timeElapsed = 0
        let timer = setInterval(function(){
            game.timeElapsed += 1
        }, 1000, )

        this._timerView = document.querySelector(".time-elapsed")
        this._locksView = document.querySelector(".locks-remaining")
        this._enemiesView = document.querySelector(".enemies-defeated")
    }

    _updateGameStatus(){
        let minutes = Math.floor(this.timeElapsed /60)
        let seconds = Math.floor((this.timeElapsed/60 - minutes)*60)
        if (String(seconds).length < 2){
            seconds = `0${seconds}`
        }

        this._timerView.textContent = `time elapsed: ${minutes}:${seconds}`
        this._locksView.textContent = `Locks remaining: ${this.lockGroup.objectList.length - this.player.locksOpened}`
        this._enemiesView.textContent = `Enemies defeated: ${this.player.enemiesKilled}`
    }

    setActiveInventorySlot(slot){
        if (this.activeInventorySlot !== slot){
            let prevSlot = this.activeInventorySlot
            this.activeInventorySlot = slot
            let slotView = document.getElementById(`slot-${slot}`);
            let prevSlotView = document.getElementById(`slot-${prevSlot}`)
            slotView.style.backgroundImage = "url(/static/img/active_slot.png)"
            prevSlotView.style.backgroundImage = "none"
        }
    }

    checkWinCondition() {
        for (const lock of this.lockGroup.objectList){
            if (lock.locked){
                return false;
            }
        }
        this.gameEnd(true)
        return true;
    }

    spawnEnemies(){
        let id = 0;
        for (const coord of this.enemySpawnPositions){
            id += 1
            let enemy = new Enemy(id)
            this.enemyGroup.push(enemy);
            enemy.spawn(coord.y,  coord.x)
        }
    }

    spawnPlayer(){
        this.player = new Player();
        let sword = new Item('sword', 1);
        let swordReference = this.itemGroup.push(sword);
        this.player.inventory.insertItem(swordReference, 0);
    }

    defineMaze(){
        this.maze = new Maze(mazeSeed);

        // populating tree and calculating enemy spawn positions
        let enemyNumber = Math.floor(3**(((this.maze.height*this.maze.width)**(1/2))/5))
        if (enemyNumber > maxEnemies && maxEnemies !== -1){
            enemyNumber = maxEnemies
        }
        let enemySpawnSpacing = Math.floor((this.maze.height*this.maze.width)/enemyNumber)
        if (enemyNumber === 0){
            enemySpawnSpacing = 0
        }

        let index = 0;
        let deadEndCodes = ['0111', '1011', '1101', '1110'];
        this.deadEndPositions = []
        let corridorCodes = ['1010', '0101']

        this.enemySpawnPositions = []

        for (let row = 1; row <= this.maze.height; row++) {
            let rowList = [];
            for (let column = 1; column <= this.maze.width; column++) {

                let bin = this.maze.binaryString.slice(0,4);

                if (deadEndCodes.includes(bin)){
                    this.deadEndPositions.push({y:row, x:column})
                } else if (!corridorCodes.includes(bin) && (index%(enemySpawnSpacing-Math.floor(enemySpawnSpacing/2)) === 0) && enemyNumber !==  0){
                    this.enemySpawnPositions.push({y:row, x:column})
                }

                let walls = {top: parseInt(bin[0]), bottom: parseInt(bin[1]), left: parseInt(bin[2]), right: parseInt(bin[3])};
                let node = new Node(row, column, walls);

                rowList.push(node);
                this.maze.binaryString = this.maze.binaryString.slice(4);
                index += 1;
            }
            this.maze.adjacencyList.push(rowList);
        }
        this.maze.output();

        this.determineLockAndKeyPositions()
    }

    determineLockAndKeyPositions(){
        // spawning locks and keys
        let noDeadEnds = this.deadEndPositions.length;
        let even = 0
        if (noDeadEnds > maxLocks && maxLocks !== -1){
            noDeadEnds = maxLocks
        }

        if ((noDeadEnds-1)%2 === 1){
            even = 1;
        }

        for (let n = noDeadEnds-1; n >= noDeadEnds%2; n--) {

            let nodePosition = this.deadEndPositions[n];

            if (n % 2 === even) {
                let key = new Item('key', n)
                let keyReference = this.itemGroup.push(key)
                key.entity.spawn(nodePosition.y, nodePosition.x)

                this.maze.adjacencyList[nodePosition.y - 1][nodePosition.x - 1].contains = keyReference;
            } else if (n % 2 !== even) {
                let lock = new Lock(n);
                let lockReference = this.lockGroup.push(lock)
                lock.entity.spawn(nodePosition.y, nodePosition.x)

                this.maze.adjacencyList[nodePosition.y - 1][nodePosition.x - 1].contains = lockReference;
            }
        }
    }

    defineMazeProperties(){
        // setting css properties to correct values
        this.root = document.querySelector(':root');
        this.root.style.setProperty('--map-width', this.maze.width);
        this.root.style.setProperty('--map-height', this.maze.height);

        this.imgWidth = (this.maze.width * mazeScale) - 64;
        this.imgHeight = (this.maze.height * mazeScale) - 50;
    }

    gameEnd(hasWon){
        let continueLocation = ""
        if ((hasWon === true && game.maze.height*game.maze.width >= 25) || gameComplete === 1){
            continueLocation = "/gamecomplete"
        }

        this._gameOver = true;
        this.level.id = "hidden"
        this.endScreen.id = "shown"
        let score = Math.floor((this.maze.height * this.maze.width)/100 * (((2 ** -((this.timeElapsed/200) - 10)) + 50) + (this.player.enemiesKilled * 10) + (this.player.locksOpened * 15)))

        let popOut = this.endScreen.firstElementChild
        let message = popOut.firstElementChild

        let scoreDisplay = document.querySelector(".score");
        scoreDisplay.textContent = `Score: ${score}`

        let restartButton = document.createElement('button');
        popOut.appendChild(restartButton)

        if (hasWon === true){
            let sizeIncrease = 2
            if (this.maze.height % 5 === 0){
                sizeIncrease = 3
            }
            if (continueLocation === ""){
            continueLocation = `/play?height=${this.maze.height + sizeIncrease}&width=${this.maze.width + sizeIncrease}`
            }

            restartButton.textContent = "Try again?"
            restartButton.onclick = function(){
                window.location.href = window.location.href
            }

            let continueButton = document.createElement('button')
            continueButton.textContent = "Continue?"
            continueButton.onclick = function() {
                window.location.href = continueLocation
            }

            popOut.appendChild(continueButton)
            message.style.backgroundImage = "url(/static/img/levelcomplete.png)"

        } else {
            restartButton.textContent = "Restart?"
            restartButton.onclick = function(){
                window.location.href = "/"
            }
            message.style.backgroundImage = "url(/static/img/gameover.png)"
        }
    }

    // determines where the character (and maze) is positioned every frame
    gameLoop() {
        if (this._gameOver === true){
            return
        }
        // need to get pixel size every frame as it varies depending on how large the browser window is
        pixelSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--pixel-size'));

        this.player.move();
        for (const enemy of this.enemyGroup.objectList){
            enemy.move()
            enemy.attack()
        }

        for (const key of this.itemGroup.objectList){
            key.update()
        }

        for (const lock of this.lockGroup.objectList){
            lock.update()
        }
        this._updateGameStatus()
    }

    // steps through every frame
    step() {
        this.gameLoop();
        window.requestAnimationFrame(function () {
            game.step();
        })
    }
}

game = new GameController()
game.defineMaze()
game.defineMazeProperties()
game.spawnPlayer()
game.spawnEnemies()
game.step();


// event listeners for keys being pressed and released
document.addEventListener('keydown', function (e) {
    let direction = directionKeys[e.key];
    let inventorySlot = inventoryKeys[e.key];
    let command = commands[e.key];
    // adds last key pressed to the start of the held_directions array
    if (direction && game.held_directions.indexOf(direction) === -1) {
        game.held_directions.unshift(direction);
    } else if (inventorySlot) {
        game.setActiveInventorySlot(inventorySlot-1);
    } else if (command){
        game.player.executeCommand(command)
    }
})

document.addEventListener('keyup', function (e) {
    let direction = directionKeys[e.key];
    let index = game.held_directions.indexOf(direction);
    // removes key from help_directions when it stops being pressed
    if (index > -1) {
        game.held_directions.splice(index, 1);
    }
})