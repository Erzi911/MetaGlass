//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.31;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";

contract Nerd is ERC20, Ownable{
    uint256 public maxU=100*10**18;
    address[] public hs;

}
event queue(address indexed user, uint256 amount, string status);
constructor() ERC20("MetaGlass", "MTG") {
    _mint(msg.sender, 100*10**18);
    hs.push(msg.sender);
}
function mint(address to, uint256 kol) public onlyOwner {
    require(totalSupply() + kol <= 1000*10**18);
    require(balanceOf(to) + kol <= maxU);
    if (balanceOf(to) == 0) hs.push(to);
    _mint(to, kol);
}
function status(address acc) public view returns(string memory){
    uint256 b=balanceOf(acc);
}
function update(){}