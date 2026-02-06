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
event FeeUpdated(uint16 feeBps, address indexed feeRecipient);
event FeeExemptSet(address indexed user, bool exempt);  
constructor(address _feeRecipient) ERC20("MetaGlass", "MTG") Ownable(msg.sender){
    require(_feeRecipient!=address(0));
    feeRecipient=_feeRecipient;
    _mint(msg.sender, 100*10**18);
    hs.push(msg.sender);
    feeExempt[msg.sender]=true;
    feeExempt[_feeRecipient]=t
    feeExempt[address(this)]=true;
    
}
function hsLen() external view returns(uint256){
    return hs.length;
}
function setFee(uint16 _feeBps, address _feeRecipient) external onlyOwner {
   require(_feeRecipient!=address(0));
   require(_feeBps<=1000);
   feeBps=_feeBps;
   feeRecipient=_feeRecipient;
   emit FeeUpdated(_feeBps, _feeRecipient);
}
function setFeeExempt(address user, bool exempt) external onlyOwner {
    feeExempt[user]=exempt;
    emit FeeExemptSet(user, exempt);
}   
function mint(address to, uint256 kol) public onlyOwner {
    require(totalSupply() + kol <= 1000*10**18);
    require(balanceOf(to) + kol <= maxU);
    if(!inHs[to]){
        hs.push(to);
        inHs[to]=true;
    }
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
function _update(address from, address to, uint256 amount) internal override{
    if(from!=address(0) && to!=address&&amount>0){
        if(!inHs[to]){
            hs.push(to);
            inHs[to]=true;
        }
        if (!feeExempt[from] && !feeExempt[to] && feeBps > 0) {
                uint256 fee = (amount * feeBps) / 10_000;
                if (fee > 0) {
                    uint256 net = amount - fee;
                    require(balanceOf(to) + net <= maxU);
                    super._update(from, feeRecipient, fee);
                    super._update(from, to, net);
                    return;
                }
            }
            require(balanceOf(to) + amount <= maxU);
            super._update(from, to, amount);
            return;
        }

        if (to != address(0) && amount > 0) {
            require(balanceOf(to) + amount <= maxU);
            if (!inHs[to]) {
                hs.push(to);
                inHs[to] = true;
            }
        }
        super._update(from, to, amount);
    }
}
}