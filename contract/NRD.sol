//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.31;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Nerd is ERC20, Ownable{
    uint256 public constant maxS=1000*10**18;
    uint256 public constant maxU=100*10**18;
    address[] public hs;
}
event queue(address indexed user, uint256 amount, string status);
constructor() ERC20("MetaGlass", "MTG") {}
function mint(address to, uint256 kol) public onlyOwner {
    require(balanceOf(to) + kol <= maxU);
    _mint(to, kol);
}
function status(address acc) public view returns(string memory){
    uint256 b=balanceOf(acc);
}
function restrict(){}

function queue(){}