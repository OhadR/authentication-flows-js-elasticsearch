import { AuthenticationAccountRepository,
	AuthenticationUser,
    AuthenticationUserImpl } from 'authentication-flows-js';
import { EsBaseRepository } from "./elasticsearch-base-repository";
const debug = require('debug')('authentication-account-elasticsearch-repository');

const AUTH_ACCOUNT_INDEX: string = 'authentication-account';

export class AuthenticationAccountElasticsearchRepository implements AuthenticationAccountRepository extends EsBaseRepository<AuthenticationUser> {

    protected getIndex(): string {
        return AUTH_ACCOUNT_INDEX;
    }

    loadUserByUsername(username: string): AuthenticationUser {
        return this.users.get(username);
    }

    setEnabled(username: string) {
        this.setEnabledFlag(username, true);
    }

    setDisabled(username: string) {
        this.setEnabledFlag(username, false);
    }

    protected setEnabledFlag(username: string, flag: boolean) {

        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);
        const newUser: AuthenticationUser = new AuthenticationUserImpl(
            username,
            storedUser.getPassword(),
            flag,
            storedUser.getLoginAttemptsLeft(),
            storedUser.getPasswordLastChangeDate(),
            storedUser.getFirstName(),
            storedUser.getLastName(),
            storedUser.getAuthorities(),
            storedUser.getLink(),
            storedUser.getLinkDate()
        );

        //delete old user and set a new one, since iface does not support "setPassword()":
        this.deleteUser(username);
        this.users.set(username, newUser);
    }

    isEnabled(username: string): boolean {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);
        if (!storedUser)
            return false;
        return storedUser.isEnabled();
    }

    //TODO: should be in abstract class
    async decrementAttemptsLeft(username: string) {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        let attempts = storedUser.getLoginAttemptsLeft();
        debug(`current num attempts: ${attempts}`);
        await this.setAttemptsLeft(username, --attempts);
    }

    setAttemptsLeft(username: string, numAttemptsAllowed: number) {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);

        const newUser: AuthenticationUser = new AuthenticationUserImpl(
            username,
            storedUser.getPassword(),
            storedUser.isEnabled(),
            numAttemptsAllowed,
            storedUser.getPasswordLastChangeDate(),
            storedUser.getFirstName(),
            storedUser.getLastName(),
            storedUser.getAuthorities(),
            storedUser.getLink(),
            storedUser.getLinkDate()
        );

        //delete old user and set a new one, since iface does not support "setPassword()":
        this.deleteUser(username);
        this.users.set(username, newUser);
    }

    setPassword(username: string, newPassword: string) {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);

        const newUser: AuthenticationUser = new AuthenticationUserImpl(
            username,
            newPassword,
            storedUser.isEnabled(),
            storedUser.getLoginAttemptsLeft(),
            storedUser.getPasswordLastChangeDate(),
            storedUser.getFirstName(),
            storedUser.getLastName(),
            storedUser.getAuthorities(),
            null, null          //when resetting the password, delete the links so they become invalid.
        );

        //delete old user and set a new one, since iface does not support "setPassword()":
        this.deleteUser(username);
        this.users.set(username, newUser);
    }

    //TODO: should be in abstract class, async/await
    getEncodedPassword(username: string): string {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);
        if (!storedUser)
            return null;
        return storedUser.getPassword();
    }

    getPasswordLastChangeDate(username: string): Date {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);
        return storedUser.getPasswordLastChangeDate();
    }

    setAuthority(username: string, authority: string) {
        throw new Error("Method not implemented.");
    }

    createUser(authenticationUser: AuthenticationUser): void {
        debug('createUser / inmem implementation!');

        const newUser: AuthenticationUser = new AuthenticationUserImpl(authenticationUser.getUsername(),
            authenticationUser.getPassword(),
            false,
            authenticationUser.getLoginAttemptsLeft(),
            new Date(),
            authenticationUser.getFirstName(),
            authenticationUser.getLastName(),
            authenticationUser.getAuthorities(),
            authenticationUser.getLink(),
            authenticationUser.getLinkDate());

        if( this.userExists( newUser.getUsername() ) )
        {
            //ALREADY_EXIST:
            throw new Error(`user ${newUser.getUsername()} already exists`);
        }

        this.users.set(newUser.getUsername(), newUser);
    }

    deleteUser(username: string): void {
        this.users.delete(username);
    }

    userExists(username: string): boolean {
        debug('userExists?');
        return this.users.has(username);
    }

    addLink(username: string, link: string) {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);

        const newUser: AuthenticationUser = new AuthenticationUserImpl(
            username,
            storedUser.getPassword(),
            storedUser.isEnabled(),
            storedUser.getLoginAttemptsLeft(),
            storedUser.getPasswordLastChangeDate(),
            storedUser.getFirstName(),
            storedUser.getLastName(),
            storedUser.getAuthorities(),
            link,
            new Date()
        );

        //delete old user and set a new one, since iface does not support "setPassword()":
        this.deleteUser(username);
        this.users.set(username, newUser);
    }

    /**
     * remove link
     * @param link
     */
    removeLink(username: string): boolean {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);

        if(!storedUser.getLink())
            return false;

        const newUser: AuthenticationUser = new AuthenticationUserImpl(
            username,
            storedUser.getPassword(),
            storedUser.isEnabled(),
            storedUser.getLoginAttemptsLeft(),
            storedUser.getPasswordLastChangeDate(),
            storedUser.getFirstName(),
            storedUser.getLastName(),
            storedUser.getAuthorities(),
            null
        );

        //delete old user and set a new one, since iface does not support "setPassword()":
        this.deleteUser(username);
        this.users.set(username, newUser);
        return true;
    }

    //this is for the automation only:
    getLink(username: string): { link: string; date: Date; } {
        const storedUser: AuthenticationUser =  this.loadUserByUsername(username);
        return {
            link: storedUser.getLink(),
            date: storedUser.getLinkDate()
        };
    }

    /**
     * in real DB we will index also the link. In-mem impl just iterates over all entries.
     * @param link
     */
    getUsernameByLink(link: string): string {
        for (let user of this.users.values()) {
            debug(`########### ${user.getLink()} vs ${link}`);
            if(user.getLink() === link)
                return user.getUsername();
        }
        throw new Error("Could not find any user with this link.");
    }
}
