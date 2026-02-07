//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface INerd {
  function mint(address to, uint256 kol) external;
  function balanceOf(address acc) external view returns (uint256);
}

contract Crowdfund {
  struct Campaign {
    string title;
    uint256 goal;
    uint256 deadline;
    uint256 totalRaised;
    bool finalized;
    bool successful;
    address creator;
  }

  address public owner;
  INerd public nerd;
  address public treasury;

  mapping(address => bool) public campaignCreators;

  uint256 public constant REWARD_RATE = 100 * 1e18; 

  uint256 public campaignCount;
  mapping(uint256 => Campaign) public campaigns;
  mapping(uint256 => mapping(address => uint256)) public contributions;

  modifier onlyOwner() {
    require(msg.sender == owner, "not owner");
    _;
  }

  modifier onlyCreator() {
    require(msg.sender == owner || campaignCreators[msg.sender], "not creator");
    _;
  }

  event OwnershipTransferred(address indexed prev, address indexed next);
  event CampaignCreatorSet(address indexed user, bool allowed);
  event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint256 deadline);
  event Contributed(uint256 indexed id, address indexed contributor, uint256 amountEth, uint256 rewardTokens);
  event CampaignFinalized(uint256 indexed id, bool successful);
  event RefundClaimed(uint256 indexed id, address indexed contributor, uint256 amount);

  constructor(address nerdAddress, address treasury_) {
    require(nerdAddress != address(0), "nerd zero");
    require(treasury_ != address(0), "treasury zero");
    owner = msg.sender;
    emit OwnershipTransferred(address(0), msg.sender);
    nerd = INerd(nerdAddress);
    treasury = treasury_;
  }

  function setCampaignCreator(address user, bool allowed) external onlyOwner {
    require(user != address(0), "zero user");
    campaignCreators[user] = allowed;
    emit CampaignCreatorSet(user, allowed);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "zero owner");
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  function setTreasury(address newTreasury) external onlyOwner {
    require(newTreasury != address(0), "zero treasury");
    treasury = newTreasury;
  }

  function createCampaign(string calldata title, uint256 goalWei, uint256 durationSeconds) external onlyCreator returns (uint256 id) {
    require(bytes(title).length > 0, "title empty");
    require(goalWei > 0, "goal=0");
    require(durationSeconds > 0, "duration=0");

    id = ++campaignCount;
    Campaign storage c = campaigns[id];
    c.title = title;
    c.goal = goalWei;
    c.deadline = block.timestamp + durationSeconds;
    c.creator = msg.sender;

    emit CampaignCreated(id, msg.sender, title, goalWei, c.deadline);
  }

  function contribute(uint256 id) external payable {
    Campaign storage c = campaigns[id];
    require(bytes(c.title).length != 0, "campaign not found");
    require(block.timestamp < c.deadline, "ended");
    require(msg.value > 0, "no value");

    c.totalRaised += msg.value;
    contributions[id][msg.sender] += msg.value;

    uint256 tokensOut = (msg.value * REWARD_RATE) / 1e18;
    nerd.mint(msg.sender, tokensOut);

    emit Contributed(id, msg.sender, msg.value, tokensOut);
  }

  function finalizeCampaign(uint256 id) external {
    Campaign storage c = campaigns[id];
    require(bytes(c.title).length != 0, "campaign not found");
    require(block.timestamp >= c.deadline, "not ended");
    require(!c.finalized, "finalized");

    c.finalized = true;
    if (c.totalRaised >= c.goal) {
      c.successful = true;
      (bool ok, ) = c.creator.call{value: c.totalRaised}("");
      require(ok, "payout failed");
    }

    emit CampaignFinalized(id, c.successful);
  }

  function claimRefund(uint256 id) external {
    Campaign storage c = campaigns[id];
    require(c.finalized, "not finalized");
    require(!c.successful, "successful");
    uint256 amount = contributions[id][msg.sender];
    require(amount > 0, "no contribution");

    contributions[id][msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "refund failed");

    emit RefundClaimed(id, msg.sender, amount);
  }

  function getCampaign(uint256 id)
    external
    view
    returns (
      string memory title,
      uint256 goal,
      uint256 deadline,
      uint256 totalRaised,
      bool finalized,
      bool successful,
      address creator
    )
  {
    Campaign storage c = campaigns[id];
    require(bytes(c.title).length != 0, "campaign not found");
    return (c.title, c.goal, c.deadline, c.totalRaised, c.finalized, c.successful, c.creator);
  }

  function getMyContribution(uint256 id) external view returns (uint256) {
    return contributions[id][msg.sender];
  }

  function getCampaignsCount() external view returns (uint256) {
    return campaignCount;
  }

  function withdrawLeftover(address to) external onlyOwner {
    require(to != address(0), "zero address");
    (bool ok, ) = to.call{value: address(this).balance}("");
    require(ok, "withdraw failed");
  }
}

