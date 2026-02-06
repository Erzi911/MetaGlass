//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface INerd {
    function mint(address to, uint256 amount) external;
    function updateQueue() external;
    function balanceOf(address user) external view returns (uint256);
    function position(address user) external view returns (uint256);
}

contract SmartCont {
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    INerd public token;

    bool public saleActive;
    uint256 public tokenPriceWei;
    address public treasury;

    bool public dropActive;
    uint256 public maxRankAllowed;

    event TokensPurchased(address indexed buyer, uint256 ethPaid);
    event DropConfigured(bool active, uint256 maxRank);

    constructor(address tokenAddress, address treasury_, uint256 tokenPriceWei_) {
        owner = msg.sender;
        token = INerd(tokenAddress);
        treasury = treasury_;
        tokenPriceWei = tokenPriceWei_;
        saleActive = true;
    }

    function buyTokens() external payable {
        require(saleActive, "sale off");
        require(msg.value > 0, "no eth");

        uint256 amount = (msg.value * 1e18) / tokenPriceWei;
        token.mint(msg.sender, amount);

        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok);

        emit TokensPurchased(msg.sender, msg.value);
    }

    function configureDrop(bool active, uint256 maxRank) external onlyOwner {
        dropActive = active;
        maxRankAllowed = maxRank;
        emit DropConfigured(active, maxRank);
    }

    function buyGlasses() external {
        require(dropActive, "drop off");
        require(token.position(msg.sender) <= maxRankAllowed, "not your turn");
    }   
}