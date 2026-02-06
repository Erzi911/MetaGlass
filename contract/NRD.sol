//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.31;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";

contract Nerd is ERC20, Ownable{
    uint256 public maxU=100*10**18;
    address[] public hs;
    mapping(address=>uint256) public position;
    mapping(address=>bool) public inHs;
    uint16 public feeBps=200;
    address public feeRecipient;
    mapping(address=>bool) public feeExempt;

event Queue(address indexed user, uint256 amount, string status);
constructor() ERC20("MetaGlass", "MTG") Ownable(msg.sender){
    _mint(msg.sender, 100*10**18);
    hs.push(msg.sender);
}
function mint(address to, uint256 kol) public onlyOwner {
    require(totalSupply() + kol <= 1000*10**18);
    require(balanceOf(to) + kol <= maxU);
    if (balanceOf(to) == 0) hs.push(to);
    _mint(to, kol);
}
function status(address acc) public view returns(uint256 b, uint256 pos){
    b=balanceOf(acc);
    pos=position[acc];
}
function update()public{
    for(uint i=0;i<hs.length;i++){
        address u=hs[i];
        uint256 bal=balanceOf(u);
        uint256 newPos=1;
        for(uint j=0;j<hs.length;j++){
            if(bal<balanceOf(hs[j])) newPos++;
        }
        position[u]=newPos;
    } 
    emit Queue(msg.sender, balanceOf(msg.sender), "updated");

}
}