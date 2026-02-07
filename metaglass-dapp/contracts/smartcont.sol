//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface INerd {
    function mint(address to, uint256 kol) external;
    function update() external;
    function balanceOf(address acc) external view returns (uint256);
    function position(address acc) external view returns (uint256);
}

contract SmartCont {
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    event OwnershipTransferred(address indexed prev, address indexed next);

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    INerd public nerd;

    bool public saleActive = true;
    address public treasury;
    uint256 public priceWeiPerToken;

    uint256 public dropId;
    bool public dropActive;
    uint256 public glassesPriceWei;
    uint256 public glassesLeft;
    uint256 public maxPositionAllowed;

    uint256 public lastQueueUpdateTs;
    uint256 public maxQueueStalenessSeconds = 15 minutes;

    mapping(address => uint256) public lastBoughtDrop;

    event SaleParamsUpdated(bool saleActive, uint256 priceWeiPerToken, address indexed treasury);
    event TokensBought(address indexed buyer, uint256 ethIn, uint256 tokensOut);
    event QueueRefreshed(address indexed caller, uint256 atTs);
    event DropConfigured(uint256 indexed dropId, bool dropActive, uint256 priceWei, uint256 left, uint256 maxPos);
    event GlassesBought(uint256 indexed dropId, address indexed buyer, uint256 position, uint256 paidWei);

    constructor(address nerdAddress, address treasury_, uint256 priceWeiPerToken_) {
        require(nerdAddress != address(0));
        require(treasury_ != address(0));
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        nerd = INerd(nerdAddress);
        treasury = treasury_;
        priceWeiPerToken = priceWeiPerToken_;
        emit SaleParamsUpdated(saleActive, priceWeiPerToken, treasury);
    }

    function setSaleParams(bool saleActive_, uint256 priceWeiPerToken_, address treasury_) external onlyOwner {
        require(treasury_ != address(0));
        saleActive = saleActive_;
        priceWeiPerToken = priceWeiPerToken_;
        treasury = treasury_;
        emit SaleParamsUpdated(saleActive, priceWeiPerToken, treasury);
    }

    function setDropActive(bool active) external onlyOwner {
        dropActive = active;
    }

    function configureNewDrop(bool active, uint256 priceWei, uint256 left, uint256 maxPos) external onlyOwner {
        dropId += 1;
        dropActive = active;
        glassesPriceWei = priceWei;
        glassesLeft = left;
        maxPositionAllowed = maxPos;
        emit DropConfigured(dropId, dropActive, glassesPriceWei, glassesLeft, maxPositionAllowed);
    }

    function advanceWindow(uint256 newMaxPos) external onlyOwner {
        require(newMaxPos >= maxPositionAllowed);
        maxPositionAllowed = newMaxPos;
    }

    function setQueueStaleness(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 60);
        maxQueueStalenessSeconds = seconds_;
    }

    function buyTokens() external payable {
        require(saleActive);
        require(priceWeiPerToken > 0);
        require(msg.value > 0);

        uint256 tokensOut = (msg.value * 1e18) / priceWeiPerToken;
        require(tokensOut > 0);

        nerd.mint(msg.sender, tokensOut);
        emit TokensBought(msg.sender, msg.value, tokensOut);

        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok);
    }

    function refreshQueue() external {
        nerd.update();
        lastQueueUpdateTs = block.timestamp;
        emit QueueRefreshed(msg.sender, lastQueueUpdateTs);
    }

    function buyGlasses() external payable {
        require(dropActive);
        require(glassesLeft > 0);
        require(msg.value == glassesPriceWei);
        require(lastBoughtDrop[msg.sender] != dropId);
        require(lastQueueUpdateTs != 0);
        require(block.timestamp - lastQueueUpdateTs <= maxQueueStalenessSeconds);
        require(nerd.balanceOf(msg.sender) > 0);

        uint256 pos = nerd.position(msg.sender);
        require(pos > 0 && pos <= maxPositionAllowed);

        lastBoughtDrop[msg.sender] = dropId;
        glassesLeft -= 1;

        emit GlassesBought(dropId, msg.sender, pos, msg.value);

        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok);
    }

    function withdraw(address to) external onlyOwner {
        require(to != address(0));
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok);
    }
}
