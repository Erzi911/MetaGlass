//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Nerd is ERC20, Ownable{
    uint256 public constant maxS=1000*10**18;
    uint256 public constant maxU=100*10**18;
}
constructor() ERC20("MetaGlass", "MTG") {}
function mint(address to, uint256 kol) public onlyOwner {
    require(totalSupply() + kol <= maxS);
    _mint(to, kol);
}
function status(address account) public view returns (string memory){
    uint256 wall=balanceOf(account);
    }