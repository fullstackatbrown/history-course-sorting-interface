import NavBar from './components/NavBar';
import { useEffect, useState } from "react";
import { IUser } from "../../server/src/models/User";
import { setAuthenticatedUser } from "./utils/auth";
import { changeRole } from "./utils/users";
import { fetchUsers } from "./utils/users";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useNavigate } from 'react-router-dom';

function ManageRoles() {
  const allRoles = ['default', 'curriculum coordinator', 'professor', 'undergraduate director', 'graduate director', 'manager'];

  const navigate = useNavigate();
  const [user, setUser] = useState<IUser>();
  const [allUsers, setAllUsers] = useState<IUser[]>();
  const [alertOpen, setAlertOpen] = useState(false);
  const [lastUser, setLastUser] = useState<IUser>();
  const [lastRole, setLastRole] = useState('');

  // called once when components on page have rendered
  async function getAllUsers() {
    await fetchUsers(setAllUsers, false);
  }

  async function getUser() {
    await setAuthenticatedUser(setUser);
  }

  useEffect(() => {
    getUser();
    getAllUsers();
  }, []);

  async function handleClose(isAccepted: boolean) {
    if (isAccepted) {
      await changeRole(lastUser!, lastRole)
      getUser()
      getAllUsers();
    }
    setAlertOpen(false);
  }

  async function handleDropdownChange(u: IUser, value: string) {
    if (value === "manager" || u.role === "manager") {
      setLastUser(u);
      setLastRole(value);
      setAlertOpen(true);
    } else {
      await changeRole(u, value);
      getUser()
      getAllUsers();
    }
  }

  if (user?.role !== "manager") {
    navigate('/course_catalog');
  }

  return (
    <>
      <NavBar user={user} />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allUsers?.map(u => (
              <TableRow key={u.displayName}>
                <TableCell>{u.displayName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select
                    size='small'
                    defaultValue={u.role}
                    value={u.role}
                    onChange={(e) => handleDropdownChange(u, e.target.value)}
                    sx={{ marginRight: 1 }}
                  >
                    {allRoles.map(role =>
                      <MenuItem value={role}>{role}</MenuItem>)}
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={alertOpen} onClose={handleClose}>
        <DialogTitle>{"Are you sure?"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are attempting to either appoint someone a manager or remove someone as a manager.
            Are you sure you would like to do this?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>Go Back</Button>
          <Button onClick={() => handleClose(true)} autoFocus>Confirm</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ManageRoles;